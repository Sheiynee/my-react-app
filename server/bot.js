import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js'
import 'dotenv/config'
import { v4 as uuid } from 'uuid'
import { db } from './db.js'

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

client.once('ready', () => {
  console.log(`✅ Bot ready as ${client.user.tag}`)
})

client.on('error', (err) => console.error('Discord client error:', err))

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  const { commandName } = interaction
  const sub = interaction.options.getSubcommand()

  await interaction.deferReply()

  try {
    // ── /project ──────────────────────────────────────────

    if (commandName === 'project') {
      if (sub === 'list') {
        const [projectsSnap, tasksSnap] = await Promise.all([
          db.collection('projects').get(),
          db.collection('tasks').get(),
        ])
        const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }))

        if (!projects.length) {
          return interaction.editReply({ content: '📂 No projects yet. Create one on the web app or with `/project create`.', ephemeral: true })
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
        const description = interaction.options.getString('description') || ''
        const colors = ['#388bfd', '#3fb950', '#d29922', '#f0883e', '#bc8cff', '#f85149', '#58a6ff']
        const id = uuid()
        const project = {
          name,
          description,
          color: colors[Math.floor(Math.random() * colors.length)],
          memberIds: [],
          createdAt: new Date().toISOString(),
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
        const projectsSnap = await db.collection('projects').get()
        const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const project = projects.find(p => p.name.toLowerCase().includes(projectName.toLowerCase()))
        if (!project) return interaction.editReply({ content: `❌ Project "${projectName}" not found.`, ephemeral: true })

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
        }
        await db.collection('tasks').doc(id).set(task)
        return interaction.editReply(`✅ Task created in **${project.name}**\nID: \`${id.slice(0, 8)}\` · ${priorityEmoji(priority)} **${title}**`)
      }

      if (sub === 'done') {
        const shortId = interaction.options.getString('id')
        const snap = await db.collection('tasks').get()
        const taskDoc = snap.docs.find(d => d.id.startsWith(shortId))
        if (!taskDoc) return interaction.editReply({ content: `❌ Task \`${shortId}\` not found.`, ephemeral: true })
        await taskDoc.ref.update({ status: 'done', completedAt: new Date().toISOString() })
        return interaction.editReply(`✅ Marked **${taskDoc.data().title}** as done!`)
      }

      if (sub === 'update') {
        const shortId = interaction.options.getString('id')
        const status = interaction.options.getString('status')
        const snap = await db.collection('tasks').get()
        const taskDoc = snap.docs.find(d => d.id.startsWith(shortId))
        if (!taskDoc) return interaction.editReply({ content: `❌ Task \`${shortId}\` not found.`, ephemeral: true })
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
        const title = interaction.options.getString('title') || content.slice(0, 50)
        const projectName = interaction.options.getString('project')
        let projectId = null
        if (projectName) {
          const projectsSnap = await db.collection('projects').get()
          const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          const project = projects.find(p => p.name.toLowerCase().includes(projectName.toLowerCase()))
          projectId = project?.id || null
        }
        const id = uuid()
        await db.collection('notes').doc(id).set({
          projectId,
          title,
          content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        return interaction.editReply(`📝 Note saved!\n> ${content.slice(0, 100)}${content.length > 100 ? '…' : ''}`)
      }

      if (sub === 'list') {
        const projectName = interaction.options.getString('project')
        let query = db.collection('notes')
        if (projectName) {
          const projectsSnap = await db.collection('projects').get()
          const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          const project = projects.find(p => p.name.toLowerCase().includes(projectName.toLowerCase()))
          if (project) query = query.where('projectId', '==', project.id)
        }
        const snap = await query.get()
        const notes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
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
