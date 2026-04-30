import { db } from './db.js'
import { sendAssignmentEmail } from './email.js'

const DISCORD_TOKEN = process.env.DISCORD_TOKEN
const DISCORD_NOTIFICATION_CHANNEL_ID = process.env.DISCORD_NOTIFICATION_CHANNEL_ID
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// Discord guild IDs are numeric snowflakes (17-20 digits). Validate at module load
// so a misconfigured env var fails loudly rather than silently sending requests
// to a malformed URL.
if (DISCORD_GUILD_ID && !/^\d{17,20}$/.test(DISCORD_GUILD_ID)) {
  throw new Error(`Invalid DISCORD_GUILD_ID: must be a numeric snowflake, got "${DISCORD_GUILD_ID}"`)
}
if (DISCORD_NOTIFICATION_CHANNEL_ID && !/^\d{17,20}$/.test(DISCORD_NOTIFICATION_CHANNEL_ID)) {
  throw new Error(`Invalid DISCORD_NOTIFICATION_CHANNEL_ID: must be a numeric snowflake, got "${DISCORD_NOTIFICATION_CHANNEL_ID}"`)
}

const PRIORITY_EMOJI = { low: '🟢', medium: '🟡', high: '🟠', urgent: '🔴' }

async function discordPost(path, body) {
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Discord API ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

async function sendDiscordChannelMention(discordUserId, taskTitle, projectName, embeds) {
  if (!DISCORD_NOTIFICATION_CHANNEL_ID) return
  await discordPost(`/channels/${DISCORD_NOTIFICATION_CHANNEL_ID}/messages`, {
    content: `<@${discordUserId}> has been assigned to **${taskTitle}** in **${projectName}**`,
    embeds,
  })
}

// Resolves a Discord username → numeric snowflake ID using the Guild Members Search API.
// member.discordId stores the username entered in the Team UI — this turns it into a mentionable ID.
async function resolveDiscordNumericId(username) {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/search?query=${encodeURIComponent(username)}&limit=10`,
    { headers: { Authorization: `Bot ${DISCORD_TOKEN}` } }
  )
  if (!res.ok) return null
  const members = await res.json()
  // Search returns prefix matches — find the exact username match (case-insensitive)
  const match = members.find(m => m.user.username.toLowerCase() === username.toLowerCase())
  return match?.user.id ?? null
}

// Resolves member IDs → array of { member, numericDiscordId }
async function resolveMemberUsers(memberIds) {
  const memberDocs = await Promise.all(
    memberIds.map(id => db.collection('members').doc(id).get())
  )
  const results = []
  for (const doc of memberDocs) {
    if (!doc.exists) continue
    const member = { id: doc.id, ...doc.data() }
    if (!member.discordId) continue
    const numericDiscordId = await resolveDiscordNumericId(member.discordId)
    if (!numericDiscordId) continue
    results.push({ member, numericDiscordId })
  }
  return results
}

function buildEmbed(task, projectName, assignedByName) {
  return {
    title: task.title,
    description: `You've been assigned a task in **${projectName}**`,
    color: 0x388bfd,
    fields: [
      {
        name: 'Priority',
        value: `${PRIORITY_EMOJI[task.priority] ?? '⚪'} ${task.priority ?? 'medium'}`,
        inline: true,
      },
      {
        name: 'Due',
        value: task.dueDate
          ? new Date(task.dueDate).toLocaleDateString('en-US', { dateStyle: 'medium' })
          : 'No due date',
        inline: true,
      },
      { name: 'Assigned by', value: assignedByName, inline: true },
    ],
    url: `${FRONTEND_URL}/projects/${task.projectId}`,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Sends an email + Discord DM/mention to each newly assigned member.
 * Called fire-and-forget from task create/update endpoints — errors are logged, not thrown.
 */
export async function notifyAssignment({ addedMemberIds, task, projectName, assignedByName }) {
  if (!addedMemberIds.length) return

  const resolved = await resolveMemberUsers(addedMemberIds)
  const embed = buildEmbed(task, projectName, assignedByName)

  await Promise.allSettled(
    resolved.map(async ({ member, numericDiscordId }) => {
      // Email disabled until a verified sender domain is configured in Resend.
      // Uncomment and set EMAIL_FROM in .env to re-enable.
      // if (user.email) {
      //   await sendAssignmentEmail({
      //     toEmail: user.email,
      //     memberName: member.name || user.displayName || 'there',
      //     taskTitle: task.title,
      //     projectName,
      //     projectId: task.projectId,
      //     assignedByName,
      //     priority: task.priority,
      //     dueDate: task.dueDate,
      //   })
      // }

      // Discord channel mention — numericDiscordId resolved from username via Guild Members API
      await sendDiscordChannelMention(numericDiscordId, task.title, projectName, [embed])
    })
  )
}
