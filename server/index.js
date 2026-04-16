import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { v4 as uuid } from 'uuid'
import admin from 'firebase-admin'
import { db } from './db.js'

const { FieldValue } = admin.firestore

const app = express()
app.use(cors({ origin: ['https://joanna-bot.web.app', 'http://localhost:5173'] }))
app.use(express.json())

const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent'])

function bad(res, msg) { return res.status(400).json({ error: msg }) }

// ── Projects ──────────────────────────────────────────────

app.get('/api/projects', async (req, res) => {
  const snap = await db.collection('projects').get()
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
})

app.post('/api/projects', async (req, res) => {
  const { name } = req.body
  if (!name || typeof name !== 'string' || !name.trim()) return bad(res, 'name is required')
  const id = uuid()
  const project = {
    description: '',
    color: '#388bfd',
    memberIds: [],
    ...req.body,
    name: name.trim(),
    createdAt: new Date().toISOString(),
  }
  await db.collection('projects').doc(id).set(project)
  res.json({ id, ...project })
})

app.put('/api/projects/:id', async (req, res) => {
  const ref = db.collection('projects').doc(req.params.id)
  const doc = await ref.get()
  if (!doc.exists) return res.status(404).json({ error: 'Not found' })
  await ref.update(req.body)
  res.json({ id: req.params.id, ...doc.data(), ...req.body })
})

app.delete('/api/projects/:id', async (req, res) => {
  await db.collection('projects').doc(req.params.id).delete()
  const taskSnap = await db.collection('tasks').where('projectId', '==', req.params.id).get()
  const noteSnap = await db.collection('notes').where('projectId', '==', req.params.id).get()
  const batch = db.batch()
  taskSnap.docs.forEach(d => batch.delete(d.ref))
  noteSnap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
  res.json({ ok: true })
})

// ── Tasks ──────────────────────────────────────────────────

app.get('/api/tasks', async (req, res) => {
  let query = db.collection('tasks')
  if (req.query.projectId) query = query.where('projectId', '==', req.query.projectId)
  const snap = await query.get()
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
})

app.post('/api/tasks', async (req, res) => {
  const { title, projectId, priority } = req.body
  if (!title || typeof title !== 'string' || !title.trim()) return bad(res, 'title is required')
  if (!projectId || typeof projectId !== 'string') return bad(res, 'projectId is required')
  if (priority && !VALID_PRIORITIES.has(priority)) return bad(res, `priority must be one of: ${[...VALID_PRIORITIES].join(', ')}`)
  const id = uuid()
  const task = {
    projectId: null,
    parentId: null,
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    assigneeId: null,
    dueDate: null,
    completedAt: null,
    ...req.body,
    title: title.trim(),
    createdAt: new Date().toISOString(),
  }
  await db.collection('tasks').doc(id).set(task)
  res.json({ id, ...task })
})

app.put('/api/tasks/:id', async (req, res) => {
  const { priority } = req.body
  if (priority && !VALID_PRIORITIES.has(priority)) return bad(res, `priority must be one of: ${[...VALID_PRIORITIES].join(', ')}`)
  const ref = db.collection('tasks').doc(req.params.id)
  const doc = await ref.get()
  if (!doc.exists) return res.status(404).json({ error: 'Not found' })
  const updated = { ...doc.data(), ...req.body }
  if (req.body.status === 'done' && !doc.data().completedAt) {
    updated.completedAt = new Date().toISOString()
  } else if (req.body.status && req.body.status !== 'done') {
    updated.completedAt = null
  }
  await ref.update(updated)
  res.json({ id: req.params.id, ...updated })
})

app.delete('/api/tasks/:id', async (req, res) => {
  await db.collection('tasks').doc(req.params.id).delete()
  const [subSnap, commentSnap] = await Promise.all([
    db.collection('tasks').where('parentId', '==', req.params.id).get(),
    db.collection('comments').where('taskId', '==', req.params.id).get(),
  ])
  const batch = db.batch()
  subSnap.docs.forEach(d => batch.delete(d.ref))
  commentSnap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
  res.json({ ok: true })
})

// ── Members ────────────────────────────────────────────────

app.get('/api/members', async (req, res) => {
  const snap = await db.collection('members').get()
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
})

app.post('/api/members', async (req, res) => {
  const { name } = req.body
  if (!name || typeof name !== 'string' || !name.trim()) return bad(res, 'name is required')
  const id = uuid()
  const member = {
    color: '#388bfd',
    role: '',
    discordId: '',
    ...req.body,
    name: name.trim(),
    createdAt: new Date().toISOString(),
  }
  await db.collection('members').doc(id).set(member)
  res.json({ id, ...member })
})

app.put('/api/members/:id', async (req, res) => {
  const ref = db.collection('members').doc(req.params.id)
  const doc = await ref.get()
  if (!doc.exists) return res.status(404).json({ error: 'Not found' })
  await ref.update(req.body)
  res.json({ id: req.params.id, ...doc.data(), ...req.body })
})

app.delete('/api/members/:id', async (req, res) => {
  const memberId = req.params.id
  await db.collection('members').doc(memberId).delete()
  const [legacySnap, arraySnap] = await Promise.all([
    db.collection('tasks').where('assigneeId', '==', memberId).get(),
    db.collection('tasks').where('assigneeIds', 'array-contains', memberId).get(),
  ])
  const batch = db.batch()
  legacySnap.docs.forEach(d => batch.update(d.ref, { assigneeId: null }))
  arraySnap.docs.forEach(d => batch.update(d.ref, { assigneeIds: FieldValue.arrayRemove(memberId) }))
  await batch.commit()
  res.json({ ok: true })
})

// ── Notes ──────────────────────────────────────────────────

app.get('/api/notes', async (req, res) => {
  let query = db.collection('notes')
  if (req.query.projectId) query = query.where('projectId', '==', req.query.projectId)
  const snap = await query.get()
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
})

app.post('/api/notes', async (req, res) => {
  const { title } = req.body
  if (!title || typeof title !== 'string' || !title.trim()) return bad(res, 'title is required')
  const id = uuid()
  const note = {
    projectId: null,
    content: '',
    ...req.body,
    title: title.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await db.collection('notes').doc(id).set(note)
  res.json({ id, ...note })
})

app.put('/api/notes/:id', async (req, res) => {
  const ref = db.collection('notes').doc(req.params.id)
  const doc = await ref.get()
  if (!doc.exists) return res.status(404).json({ error: 'Not found' })
  const updated = { ...doc.data(), ...req.body, updatedAt: new Date().toISOString() }
  await ref.update(updated)
  res.json({ id: req.params.id, ...updated })
})

app.delete('/api/notes/:id', async (req, res) => {
  await db.collection('notes').doc(req.params.id).delete()
  res.json({ ok: true })
})

// ── Comments ───────────────────────────────────────────────

app.get('/api/comments', async (req, res) => {
  let query = db.collection('comments')
  if (req.query.taskId) query = query.where('taskId', '==', req.query.taskId)
  const snap = await query.get()
  const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  res.json(comments)
})

app.post('/api/comments', async (req, res) => {
  const { taskId, content } = req.body
  if (!taskId || typeof taskId !== 'string') return bad(res, 'taskId is required')
  if (!content || typeof content !== 'string' || !content.trim()) return bad(res, 'content is required')
  const id = uuid()
  const comment = {
    taskId,
    content: content.trim(),
    authorName: req.body.authorName?.trim() || 'Anonymous',
    createdAt: new Date().toISOString(),
  }
  await db.collection('comments').doc(id).set(comment)
  res.json({ id, ...comment })
})

app.delete('/api/comments/:id', async (req, res) => {
  await db.collection('comments').doc(req.params.id).delete()
  res.json({ ok: true })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`))
