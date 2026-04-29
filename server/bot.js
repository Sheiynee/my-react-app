import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js'
import 'dotenv/config'
import { v4 as uuid } from 'uuid'
import { db } from './db.js'

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent'])
const VALID_STATUSES = new Set(['todo', 'in_progress', 'done'])

client.once('ready', () => {
  console.log(`✅ Bot ready as ${client.user.tag}`)
})

client.on('error', (err) => console.error('Discord client error:', err))

// Role helpers mirrored from server/index.js so the bot enforces the same auth model.
const ROLE_RANK = { viewer: 0, member: 1, manager: 2, admin: 3 }
function hasRole(userRole, minRole) {
  return (ROLE_RANK[userRole] ?? -1) >= ROLE_RANK[minRole]
}
function getUserProjectRole(uid, projectData) {
  const { roles, createdBy } = projectData
  if (!roles || Object.keys(roles).length === 0) return createdBy === uid ? 'admin' : null
  return roles[uid] || null
}

// Resolve the Discord interaction user to a linked Firebase user. Returns null if
// that Discord account hasn't logged into the web app yet — bot then refuses to write.
async function resolveInteractionUser(interaction) {
  const discordId = interaction.user.id
  const uid = `discord_${discordId}`
  const userDoc = await db.collection('users').doc(uid).get()
  if (!userDoc.exists) return null
  const data = userDoc.data()
  return {
    uid,
    appRole: data.role || 'employee',
    displayName: data.displayName || interaction.user.username,
  }
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  const { commandName } = interaction
  const sub = interaction.options.getSubcommand()

  await interaction.deferReply()

  try {
    // Every bot command requires the invoking Discord user to be linked to a Firebase
    // account (by logging in to the web app at least once). This ensures every write
    // has a real createdBy / roles entry and can be audited back to a user.
    const actor = await resolveInteractionUser(interaction)
    if (!actor) {
      return interaction.editReply({
        content: '🔒 Please sign in to the web app with Discord at least once before using the bot.',
        ephemeral: true,
      })
    }
    const isAppAdmin = actor.appRole === 'admin'
    // ── /project ──────────────────────────────────────────

    if (commandName === 'project') {
      if (sub === 'list') {
        const [projectsSnap, tasksSnap] = await Promise.all([
          db.collection('projects').get(),
          db.collection('tasks').get(),
        ])
        let projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        // Scope the list to projects this user can actually access.
        if (!isAppAdmin) projects = projects.filter(p => getUserProjectRole(actor.uid, p) !== null)
        const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }))

        if (!projects.length) {
          return interaction.editReply({ content: '📂 No projects you can access. Create one with `/project create`.', ephemeral: true })
        }
        const embed = new EmbedBuilder()
          .setTitle('📂 Projects')
          .setColor(0x388bfd)
          .setDescription(projects.map(p => {
            const taskCount = tasks.filter(t => t.projectId === p.id && !t.parentId).length
            const doneCount = tasks.filter(t => t.projectId === p.id && t.status === 'done' && !t.parentId).length
            return `**${p.name}**\n${p.description || '*No description*'}\n${doneCount}/${taskCount} tasks done`
          }).join('\n\n'))
        return interaction.editReply({ embeds: [embed] })
      }

      if (sub === 'create') {
        const name = interaction.options.getString('name')
        const description = (interaction.options.getString('description') || '').slice(0, 2000)
        const colors = ['#388bfd', '#3fb950', '#d29922', '#f0883e', '#bc8cff', '#f85149', '#58a6ff']
        const id = uuid()
        const project = {
          name,
          description,
          color: colors[Math.floor(Math.random() * colors.length)],
          memberIds: [],
          // Proper ownership + role assignment so the project isn't an orphan.
          roles: { [actor.uid]: 'admin' },
          createdAt: new Date().toISOString(),
          createdBy: actor.uid,
          createdByName: actor.displayName,
        }
        await db.collection('projects').doc(id).set(project)
        return interaction.editReply(`✅ Project **${name}** created! Open the web app to manage it.`)
      }
    }

    // ── /task ─────────────────────────────────────────────

    if (commandName === 'task') {
      if (sub === 'list') {
        const projectName = interaction.options.getString('project')
        const projectsSnap = await db.collection('projects').get()
        const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const project = projects.find(p => p.name.toLowerCase().includes(projectName.toLowerCase()))
        if (!project) return interaction.editReply({ content: `❌ Project "${projectName}" not found.`, ephemeral: true })
        if (!isAppAdmin && !getUserProjectRole(actor.uid, project)) {
          return interaction.editReply({ content: '🔒 You do not have access to that project.', ephemeral: true })
        }

        const tasksSnap = await db.collection('tasks').where('projectId', '==', project.id).get()
        const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => !t.parentId)
        if (!tasks.length) return interaction.editReply({ content: `📋 No tasks in **${project.name}** yet.`, ephemeral: true })

        const byStatus = { todo: [], in_progress: [], done: [] }
        for (const t of tasks) (byStatus[t.status] ?? byStatus.todo).push(t)

        const fmt = (t) => `\`${t.id.slice(0, 8)}\` ${priorityEmoji(t.priority)} ${t.title}`

        const embed = new EmbedBuilder()
          .setTitle(`📋 ${project.name}`)
          .setColor(0x388bfd)
          .addFields(
            { name: '⬜ Todo', value: byStatus.todo.map(fmt).join('\n') || '*None*', inline: false },
            { name: '🔵 In Progress', value: byStatus.in_progress.map(fmt).join('\n') || '*None*', inline: false },
            { name: '✅ Done', value: byStatus.done.map(fmt).join('\n') || '*None*', inline: false },
          )
          .setFooter({ text: 'Use the first 8 chars of the ID for /task done or /task update' })
        return interaction.editReply({ embeds: [embed] })
      }

      if (sub === 'create') {
        const projectName = interaction.options.getString('project')
        const title = interaction.options.getString('title')
        const priority = interaction.options.getString('priority') || 'medium'
        if (!VALID_PRIORITIES.has(priority)) {
          return interaction.editReply({ content: `❌ Invalid priority. Choose one of: ${[...VALID_PRIORITIES].join(', ')}`, ephemeral: true })
        }
        const projectsSnap = await db.collection('projects').get()
        const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const project = projects.find(p => p.name.toLowerCase().includes(projectName.toLowerCase()))
        if (!project) return interaction.editReply({ content: `❌ Project "${projectName}" not found.`, ephemeral: true })
        const role = getUserProjectRole(actor.uid, project)
        if (!isAppAdmin && !hasRole(role, 'member')) {
          return interaction.editReply({ content: '🔒 You do not have permission to add tasks to that project.', ephemeral: true })
        }

        const id = uuid()
        const task = {
          projectId: project.id,
          parentId: null,
          title,
          description: '',
          status: 'todo',
          priority,
          assigneeId: null,
          dueDate: null,
          completedAt: null,
          createdAt: new Date().toISOString(),
          createdBy: actor.uid,
          createdByName: actor.displayName,
        }
        await db.collection('tasks').doc(id).set(task)
        return interaction.editReply(`✅ Task created in **${project.name}**\nID: \`${id.slice(0, 8)}\` · ${priorityEmoji(priority)} **${title}**`)
      }

      // Look up a task by short-id prefix with a project allow-list filter (scoped, bounded).
      async function findTaskByShortId(shortId) {
        const accessibleProjectIds = new Set()
        const projectsSnap = await db.collection('projects').get()
        for (const p of projectsSnap.docs) {
          if (isAppAdmin || getUserProjectRole(actor.uid, p.data())) accessibleProjectIds.add(p.id)
        }
        if (!accessibleProjectIds.size) return null
        const snap = await db.collection('tasks').get()
        return snap.docs.find(d => d.id.startsWith(shortId) && accessibleProjectIds.has(d.data().projectId)) || null
      }

      if (sub === 'done') {
        const shortId = interaction.options.getString('id')
        const taskDoc = await findTaskByShortId(shortId)
        if (!taskDoc) return interaction.editReply({ content: `❌ Task \`${shortId}\` not found or no access.`, ephemeral: true })
        await taskDoc.ref.update({ status: 'done', completedAt: new Date().toISOString() })
        return interaction.editReply(`✅ Marked **${taskDoc.data().title}** as done!`)
      }

      if (sub === 'update') {
        const shortId = interaction.options.getString('id')
        const status = interaction.options.getString('status')
        if (!VALID_STATUSES.has(status)) {
          return interaction.editReply({ content: `❌ Invalid status. Choose one of: ${[...VALID_STATUSES].join(', ')}`, ephemeral: true })
        }
        const taskDoc = await findTaskByShortId(shortId)
        if (!taskDoc) return interaction.editReply({ content: `❌ Task \`${shortId}\` not found or no access.`, ephemeral: true })
        await taskDoc.ref.update({
          status,
          completedAt: status === 'done' ? new Date().toISOString() : null,
        })
        const label = { todo: 'Todo', in_progress: 'In Progress', done: 'Done' }[status]
        return interaction.editReply(`🔄 Updated **${taskDoc.data().title}** → **${label}**`)
      }
    }

    // ── /note ─────────────────────────────────────────────

    if (commandName === 'note') {
      if (sub === 'add') {
        const content = interaction.options.getString('content')
        const title = (interaction.options.getString('title') || content.slice(0, 50)).slice(0, 300)
        const projectName = interaction.options.getString('project')
        let projectId = null
        if (projectName) {
          const projectsSnap = await db.collection('projects').get()
          const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          const project = projects.find(p => p.name.toLowerCase().includes(projectName.toLowerCase()))
          if (!project) return interaction.editReply({ content: `❌ Project "${projectName}" not found.`, ephemeral: true })
          const role = getUserProjectRole(actor.uid, project)
          if (!isAppAdmin && !hasRole(role, 'member')) {
            return interaction.editReply({ content: '🔒 You do not have permission to add notes to that project.', ephemeral: true })
          }
          projectId = project.id
        }
        const id = uuid()
        await db.collection('notes').doc(id).set({
          projectId,
          title,
          content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: actor.uid,
          createdByName: actor.displayName,
        })
        return interaction.editReply(`📝 Note saved!\n> ${content.slice(0, 100)}${content.length > 100 ? '…' : ''}`)
      }

      if (sub === 'list') {
        const projectName = interaction.options.getString('project')
        let query = db.collection('notes')
        let scopedProjectId = null
        if (projectName) {
          const projectsSnap = await db.collection('projects').get()
          const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          const project = projects.find(p => p.name.toLowerCase().includes(projectName.toLowerCase()))
          if (!project) return interaction.editReply({ content: `❌ Project "${projectName}" not found.`, ephemeral: true })
          if (!isAppAdmin && !getUserProjectRole(actor.uid, project)) {
            return interaction.editReply({ content: '🔒 You do not have access to that project.', ephemeral: true })
          }
          query = query.where('projectId', '==', project.id)
          scopedProjectId = project.id
        }
        const snap = await query.get()
        // Build the set of project ids this user can access so cross-project notes stay scoped.
        let accessibleProjectIds = null
        if (!isAppAdmin && !scopedProjectId) {
          const projectsSnap = await db.collection('projects').get()
          accessibleProjectIds = new Set(projectsSnap.docs
            .filter(d => getUserProjectRole(actor.uid, d.data()))
            .map(d => d.id))
        }
        const notes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(n => {
            if (isAppAdmin || scopedProjectId) return true
            // personal notes (no projectId): only the creator sees them
            if (!n.projectId) return n.createdBy === actor.uid
            return accessibleProjectIds.has(n.projectId)
          })
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 8)

        if (!notes.length) return interaction.editReply({ content: '📝 No notes yet.', ephemeral: true })

        const embed = new EmbedBuilder()
          .setTitle('📝 Recent Notes')
          .setColor(0xbc8cff)
          .setDescription(notes.map(n =>
            `**${n.title}**\n${n.content.slice(0, 80)}${n.content.length > 80 ? '…' : ''}`
          ).join('\n\n'))
        return interaction.editReply({ embeds: [embed] })
      }
    }
  } catch (err) {
    console.error(err)
    interaction.editReply({ content: '❌ Something went wrong.', ephemeral: true })
  }
})

function priorityEmoji(priority) {
  return { low: '🟢', medium: '🟡', high: '🟠', urgent: '🔴' }[priority] ?? '⚪'
}

client.login(process.env.DISCORD_TOKEN)
