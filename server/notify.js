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

async function sendDiscordDM(discordUserId, content, embeds) {
  // Open (or reuse) a DM channel with the user, then post into it.
  const dm = await discordPost('/users/@me/channels', { recipient_id: discordUserId })
  if (!dm.id) throw new Error(`Failed to open DM channel for user ${discordUserId}`)
  await discordPost(`/channels/${dm.id}/messages`, { content, embeds })
}

async function sendDiscordChannelMention(discordUserId, taskTitle, projectName, embeds) {
  if (!DISCORD_NOTIFICATION_CHANNEL_ID) return
  await discordPost(`/channels/${DISCORD_NOTIFICATION_CHANNEL_ID}/messages`, {
    content: `<@${discordUserId}> has been assigned to **${taskTitle}** in **${projectName}**`,
    embeds,
  })
}

// Resolves member IDs → array of { member, user } for members who have a linked Discord account.
async function resolveMemberUsers(memberIds) {
  const memberDocs = await Promise.all(
    memberIds.map(id => db.collection('members').doc(id).get())
  )
  const results = []
  for (const doc of memberDocs) {
    if (!doc.exists) continue
    const member = { id: doc.id, ...doc.data() }
    if (!member.discordId) continue
    // User doc ID is discord_{discordId} — set during OAuth in index.js
    const userDoc = await db.collection('users').doc(`discord_${member.discordId}`).get()
    if (!userDoc.exists) continue
    results.push({ member, user: userDoc.data() })
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
      // Email
      if (user.email) {
        await sendAssignmentEmail({
          toEmail: user.email,
          memberName: member.name || user.displayName || 'there',
          taskTitle: task.title,
          projectName,
          projectId: task.projectId,
          assignedByName,
          priority: task.priority,
          dueDate: task.dueDate,
        })
      }

      // Discord DM
      await sendDiscordDM(
        member.discordId,
        `👋 Hey <@${member.discordId}>, you've been assigned a new task!`,
        [embed]
      )

      // Discord channel mention (only if DISCORD_NOTIFICATION_CHANNEL_ID is set)
      await sendDiscordChannelMention(member.discordId, task.title, projectName, [embed])
    })
  )
}
