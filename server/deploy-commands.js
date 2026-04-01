import { REST, Routes, SlashCommandBuilder } from 'discord.js'
import 'dotenv/config'

const commands = [
  new SlashCommandBuilder()
    .setName('project')
    .setDescription('Manage projects')
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('List all projects'))
    .addSubcommand(sub => sub
      .setName('create')
      .setDescription('Create a new project')
      .addStringOption(opt => opt.setName('name').setDescription('Project name').setRequired(true))
      .addStringOption(opt => opt.setName('description').setDescription('Short description'))),

  new SlashCommandBuilder()
    .setName('task')
    .setDescription('Manage tasks')
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('List tasks for a project')
      .addStringOption(opt => opt.setName('project').setDescription('Project name').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('create')
      .setDescription('Create a task')
      .addStringOption(opt => opt.setName('project').setDescription('Project name').setRequired(true))
      .addStringOption(opt => opt.setName('title').setDescription('Task title').setRequired(true))
      .addStringOption(opt => opt.setName('priority').setDescription('Priority level').addChoices(
        { name: 'Low', value: 'low' },
        { name: 'Medium', value: 'medium' },
        { name: 'High', value: 'high' },
        { name: 'Urgent', value: 'urgent' },
      )))
    .addSubcommand(sub => sub
      .setName('done')
      .setDescription('Mark a task as done')
      .addStringOption(opt => opt.setName('id').setDescription('Task ID (first 8 chars shown in /task list)').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('update')
      .setDescription('Update task status')
      .addStringOption(opt => opt.setName('id').setDescription('Task ID').setRequired(true))
      .addStringOption(opt => opt.setName('status').setDescription('New status').setRequired(true).addChoices(
        { name: 'Todo', value: 'todo' },
        { name: 'In Progress', value: 'in_progress' },
        { name: 'Done', value: 'done' },
      ))),

  new SlashCommandBuilder()
    .setName('note')
    .setDescription('Manage notes')
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add a note')
      .addStringOption(opt => opt.setName('content').setDescription('Note content').setRequired(true))
      .addStringOption(opt => opt.setName('title').setDescription('Note title'))
      .addStringOption(opt => opt.setName('project').setDescription('Attach to a project')))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('List recent notes')
      .addStringOption(opt => opt.setName('project').setDescription('Filter by project'))),
].map(cmd => cmd.toJSON())

const rest = new REST().setToken(process.env.DISCORD_TOKEN)

console.log('Registering slash commands...')
await rest.put(
  Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
  { body: commands }
)
console.log('✅ Slash commands registered!')