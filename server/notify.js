import { db } from './db.js'
import { sendAssignmentEmail } from './email.js'
import fetch from 'node-fetch'

const DISCORD_TOKEN = process.env.DISCORD_TOKEN
const DISCORD_NOTIFICATION_CHANNEL_ID = process.env.DISCORD_NOTIFICATION_CHANNEL_ID
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

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

// Resolves member IDs → array of { member, user } for members who have a linked Discord account.
// member.discordId stores the Discord username entered manually in the Team UI.
// The users collection stores discordUsername (handle) + discordId (numeric snowflake from OAuth).
// We query by discordUsername so we can use the numeric discordId for @mentions.
async function resolveMemberUsers(memberIds) {
  const memberDocs = await Promise.all(
    memberIds.map(id => db.collection('members').doc(id).get())
  )
  const results = []
  for (const doc of memberDocs) {
    if (!doc.exists) continue
    const member = { id: doc.id, ...doc.data() }
    if (!member.discordId) continue
    const userSnap = await db.collection('users')
      .where('discordUsername', '==', member.discordId)
      .limit(1)
      .get()
    if (userSnap.empty) continue
    results.push({ member, user: userSnap.docs[0].data() })
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
    resolved.map(async ({ member, user }) => {
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

      // Discord channel mention — user.discordId is the numeric snowflake from OAuth
      await sendDiscordChannelMention(user.discordId, task.title, projectName, [embed])
    })
  )
}
