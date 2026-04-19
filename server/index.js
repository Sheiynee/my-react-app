import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { v4 as uuid } from 'uuid'
import admin from 'firebase-admin'
import fetch from 'node-fetch'
import { db } from './db.js'

const { FieldValue } = admin.firestore

const app = express()
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://joanna-bot.web.app',
  'https://joanna-bot.firebaseapp.com',
  'https://taskflow-pm-lovat.vercel.app',
]

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    if (/^https:\/\/taskflow-.*\.vercel\.app$/.test(origin)) return cb(null, true)
    if (/^https:\/\/.*-sheiynees-projects\.vercel\.app$/.test(origin)) return cb(null, true)
    cb(new Error(`CORS: ${origin} not allowed`))
  },
}))
app.use(express.json())

const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent'])

function bad(res, msg) { return res.status(400).json({ error: msg }) }

// ── Auth middleware ────────────────────────────────────────

async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const token = header.slice(7)
    req.user = await admin.auth().verifyIdToken(token)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ── Discord OAuth ──────────────────────────────────────────

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

app.get('/auth/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email',
  })
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`)
})

app.get('/auth/discord/callback', async (req, res) => {
  const { code } = req.query
  if (!code) return res.status(400).send('Missing code')

  try {
    // Exchange code for Discord access token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    })
    const tokenData = await tokenRes.json()
    if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error)

    // Fetch Discord user profile
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const discordUser = await userRes.json()

    const uid = `discord_${discordUser.id}`
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator || 0) % 5}.png`

    // Create or update the user in Firebase Auth
    try {
      await admin.auth().updateUser(uid, {
        displayName: discordUser.global_name || discordUser.username,
        photoURL: avatarUrl,
        email: discordUser.email || undefined,
      })
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        await admin.auth().createUser({
          uid,
          displayName: discordUser.global_name || discordUser.username,
          photoURL: avatarUrl,
          email: discordUser.email || undefined,
        })
      } else {
        throw err
      }
    }

    // Upsert user doc in Firestore
    await db.collection('users').doc(uid).set({
      uid,
      displayName: discordUser.global_name || discordUser.username,
      email: discordUser.email || null,
      photoURL: avatarUrl,
      discordId: discordUser.id,
      discordUsername: discordUser.username,
      provider: 'discord',
      role: 'member',
      updatedAt: new Date().toISOString(),
    }, { merge: true })

    // Mint a Firebase custom token and redirect to frontend
    const customToken = await admin.auth().createCustomToken(uid)
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${customToken}`)
  } catch (err) {
    console.error('Discord OAuth error:', err)
    res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`)
  }
})

// ── Current user endpoint ──────────────────────────────────

app.get('/api/me', requireAuth, async (req, res) => {
  const doc = await db.collection('users').doc(req.user.uid).get()
  if (!doc.exists) return res.status(404).json({ error: 'User not found' })
  res.json({ uid: req.user.uid, ...doc.data() })
})

app.put('/api/me', requireAuth, async (req, res) => {
  const { displayName, bio, timezone, photoURL } = req.body
  const update = {
    ...(displayName && { displayName: displayName.trim() }),
    ...(bio !== undefined && { bio }),
    ...(timezone && { timezone }),
    ...(photoURL !== undefined && { photoURL }),
    updatedAt: new Date().toISOString(),
  }
  await db.collection('users').doc(req.user.uid).set(update, { merge: true })
  res.json({ uid: req.user.uid, ...update })
})

// ── Projects ──────────────────────────────────────────────

app.get('/api/projects', requireAuth, async (req, res) => {
  const snap = await db.collection('projects').get()
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
})

app.post('/api/projects', requireAuth, async (req, res) => {
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
    createdBy: req.user.uid,
    createdByName: req.user.name || req.user.email || 'Unknown',
  }
  await db.collection('projects').doc(id).set(project)
  res.json({ id, ...project })
})

app.put('/api/projects/:id', requireAuth, async (req, res) => {
  const ref = db.collection('projects').doc(req.params.id)
  const doc = await ref.get()
  if (!doc.exists) return res.status(404).json({ error: 'Not found' })
  await ref.update(req.body)
  res.json({ id: req.params.id, ...doc.data(), ...req.body })
})

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
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

app.get('/api/tasks', requireAuth, async (req, res) => {
  let query = db.collection('tasks')
  if (req.query.projectId) query = query.where('projectId', '==', req.query.projectId)
  const snap = await query.get()
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
})

app.post('/api/tasks', requireAuth, async (req, res) => {
  const { title, projectId, priority } = req.body
  if (!title || typeof title !== 'string' || !title.trim()) return bad(res, 'title is required')
  if (!projectId || typeof projectId !== 'string') return bad(res, 'projectId is required')
  if (priority && !VALID_PRIORITIES.has(priority)) return bad(res, `priority must be one of: ${[...VALID_PRIORITIES].join(', ')}`)
  const id = uuid()
  const task = {
    projectId: null,
    parentId: null,
    description: '',
    status: 'todo',
    priority: 'medium',
    assigneeId: null,
    dueDate: null,
    completedAt: null,
    ...req.body,
    title: title.trim(),
    createdAt: new Date().toISOString(),
    createdBy: req.user.uid,
    createdByName: req.user.name || req.user.email || 'Unknown',
  }
  await db.collection('tasks').doc(id).set(task)
  res.json({ id, ...task })
})

app.put('/api/tasks/:id', requireAuth, async (req, res) => {
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

app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
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

app.get('/api/members', requireAuth, async (req, res) => {
  const snap = await db.collection('members').get()
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
})

app.post('/api/members', requireAuth, async (req, res) => {
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
    createdBy: req.user.uid,
    createdByName: req.user.name || req.user.email || 'Unknown',
  }
  await db.collection('members').doc(id).set(member)
  res.json({ id, ...member })
})

app.put('/api/members/:id', requireAuth, async (req, res) => {
  const ref = db.collection('members').doc(req.params.id)
  const doc = await ref.get()
  if (!doc.exists) return res.status(404).json({ error: 'Not found' })
  await ref.update(req.body)
  res.json({ id: req.params.id, ...doc.data(), ...req.body })
})

app.delete('/api/members/:id', requireAuth, async (req, res) => {
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

app.get('/api/notes', requireAuth, async (req, res) => {
  let query = db.collection('notes')
  if (req.query.projectId) query = query.where('projectId', '==', req.query.projectId)
  const snap = await query.get()
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
})

app.post('/api/notes', requireAuth, async (req, res) => {
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
    createdBy: req.user.uid,
    createdByName: req.user.name || req.user.email || 'Unknown',
  }
  await db.collection('notes').doc(id).set(note)
  res.json({ id, ...note })
})

app.put('/api/notes/:id', requireAuth, async (req, res) => {
  const ref = db.collection('notes').doc(req.params.id)
  const doc = await ref.get()
  if (!doc.exists) return res.status(404).json({ error: 'Not found' })
  const updated = { ...doc.data(), ...req.body, updatedAt: new Date().toISOString() }
  await ref.update(updated)
  res.json({ id: req.params.id, ...updated })
})

app.delete('/api/notes/:id', requireAuth, async (req, res) => {
  await db.collection('notes').doc(req.params.id).delete()
  res.json({ ok: true })
})

// ── Comments ───────────────────────────────────────────────

app.get('/api/comments', requireAuth, async (req, res) => {
  let query = db.collection('comments')
  if (req.query.taskId) query = query.where('taskId', '==', req.query.taskId)
  const snap = await query.get()
  const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  res.json(comments)
})

app.post('/api/comments', requireAuth, async (req, res) => {
  const { taskId, content } = req.body
  if (!taskId || typeof taskId !== 'string') return bad(res, 'taskId is required')
  if (!content || typeof content !== 'string' || !content.trim()) return bad(res, 'content is required')
  const id = uuid()
  const comment = {
    taskId,
    content: content.trim(),
    authorName: req.user.name || req.user.email || 'Unknown',
    authorUid: req.user.uid,
    createdAt: new Date().toISOString(),
  }
  await db.collection('comments').doc(id).set(comment)
  res.json({ id, ...comment })
})

app.delete('/api/comments/:id', requireAuth, async (req, res) => {
  await db.collection('comments').doc(req.params.id).delete()
  res.json({ ok: true })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`))
