import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { v4 as uuid } from 'uuid'
import { db } from './db.js'

const app = express()
app.use(cors())
app.use(express.json())

// ── Projects ──────────────────────────────────────────────

app.get('/api/projects', async (req, res) => {
  const snap = await db.collection('projects').get()
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
})

app.post('/api/projects', async (req, res) => {
  const id = uuid()
  const project = {
    name: '',
    description: '',
    color: '#388bfd',
    memberIds: [],
    ...req.body,
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
    createdAt: new Date().toISOString(),
  }
  await db.collection('tasks').doc(id).set(task)
  res.json({ id, ...task })
})

app.put('/api/tasks/:id', async (req, res) => {
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
  const subSnap = await db.collection('tasks').where('parentId', '==', req.params.id).get()
  const batch = db.batch()
  subSnap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
  res.json({ ok: true })
})

// ── Members ────────────────────────────────────────────────

app.get('/api/members', async (req, res) => {
  const snap = await db.collection('members').get()
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
})

app.post('/api/members', async (req, res) => {
  const id = uuid()
  const member = {
    name: '',
    color: '#388bfd',
    role: '',
    discordId: '',
    ...req.body,
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
  await db.collection('members').doc(req.params.id).delete()
  const taskSnap = await db.collection('tasks').where('assigneeId', '==', req.params.id).get()
  const batch = db.batch()
  taskSnap.docs.forEach(d => batch.update(d.ref, { assigneeId: null }))
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
  const id = uuid()
  const note = {
    projectId: null,
    title: '',
    content: '',
    ...req.body,
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

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`))
