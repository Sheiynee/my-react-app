import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import crypto from 'crypto'
import sanitizeHtml from 'sanitize-html'
import 'dotenv/config'
import { v4 as uuid } from 'uuid'
import admin from 'firebase-admin'
import { db } from './db.js'
import { notifyAssignment } from './notify.js'

const { FieldValue } = admin.firestore

const app = express()
app.set('trust proxy', 1)

// Allowed origins: explicit list + optional comma-separated env var for prod/preview domains.
// No wildcard regexes — every origin must be explicitly allow-listed.
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'https://joanna-bot.web.app',
  'https://joanna-bot.firebaseapp.com',
  'https://taskflow-pm-lovat.vercel.app',
  ...(process.env.EXTRA_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
])

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Explicit CSP: this API is JSON-only, so no scripts, styles, or frames
  // should ever be loaded from an API response. Acts as a second line of
  // defence if helmet's default policy ever changes.
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },
  referrerPolicy: { policy: 'no-referrer' },
}))

app.use(cors({
  origin: (origin, cb) => {
    // Reject requests with no Origin header for API routes (blocks curl / SSRF using cookies).
    // Same-origin browser requests don't need CORS anyway.
    if (!origin) return cb(null, false)
    if (ALLOWED_ORIGINS.has(origin)) return cb(null, true)
    cb(new Error(`CORS: ${origin} not allowed`))
  },
  credentials: false,
}))

// Tight body limit — no legitimate endpoint needs > 100kb.
app.use(express.json({ limit: '100kb' }))

// Global rate limiter for all /api/* and /auth/* traffic.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
})
// Stricter limiter for OAuth endpoints to block brute force / enumeration.
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth requests' },
})
// Extra-tight limiter for the token-exchange endpoint. A leaked 60s one-time
// code shouldn't be brute-forceable — cap at a handful of attempts per minute.
const exchangeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many exchange attempts' },
})
app.use('/api', globalLimiter)
app.use('/auth', authLimiter)

const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent'])

function bad(res, msg) { return res.status(400).json({ error: msg }) }

// Server-side HTML sanitization for rich-text fields (task description, note content).
// Defence in depth: DOMPurify already runs in the browser, but any non-browser consumer
// (Discord bot, future mobile client, direct API call) would otherwise render raw HTML.
// Allow only the tags Tiptap StarterKit produces. Strips <script>, on* handlers, javascript: URIs.
const SAFE_HTML_OPTIONS = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 'blockquote',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'hr',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
  },
  // Drop content of disallowed tags entirely (don't surface their text).
  nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript'],
}
function cleanRichText(html) {
  if (typeof html !== 'string') return ''
  return sanitizeHtml(html, SAFE_HTML_OPTIONS)
}

// ── Auth middleware ────────────────────────────────────────

// Tiny in-memory TTL cache for the user's app-level role. Saves a Firestore
// read on every request. 60s TTL — stale role at worst survives one minute.
// `invalidateAppRole(uid)` is called whenever we mutate a user's role.
const APP_ROLE_TTL_MS = 60 * 1000
const APP_ROLE_CACHE_MAX = 5000
const appRoleCache = new Map() // uid -> { role, expiresAt }

function invalidateAppRole(uid) {
  appRoleCache.delete(uid)
}

async function getAppRole(uid) {
  const cached = appRoleCache.get(uid)
  if (cached && cached.expiresAt > Date.now()) return cached.role
  const userDoc = await db.collection('users').doc(uid).get()
  const role = userDoc.exists ? (userDoc.data().role || 'employee') : 'employee'
  if (appRoleCache.size >= APP_ROLE_CACHE_MAX) appRoleCache.clear()
  appRoleCache.set(uid, { role, expiresAt: Date.now() + APP_ROLE_TTL_MS })
  return role
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const token = header.slice(7)
    req.user = await admin.auth().verifyIdToken(token)
    req.user.appRole = await getAppRole(req.user.uid)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

const isAppAdmin = (req) => req.user.appRole === 'admin'

// ── Role helpers ───────────────────────────────────────────

const ROLE_RANK = { viewer: 0, member: 1, manager: 2, admin: 3 }
const VALID_ROLES = new Set(Object.keys(ROLE_RANK))

function hasRole(userRole, minRole) {
  return (ROLE_RANK[userRole] ?? -1) >= ROLE_RANK[minRole]
}

// For projects without roles set, only the creator has access (as admin).
function getUserProjectRole(uid, projectData) {
  const { roles, createdBy } = projectData
  if (!roles || Object.keys(roles).length === 0) {
    return createdBy === uid ? 'admin' : null
  }
  return roles[uid] || null
}

// Returns true if uid has any role in this project.
function canAccessProject(uid, projectData) {
  return getUserProjectRole(uid, projectData) !== null
}

// Fetches the projects a user can access, using the denormalized
// `accessibleUids` index (one indexed query instead of a full scan).
// The field is maintained on every project/role mutation; backfill existing
// docs with server/scripts/backfill-accessible-uids.js.
async function listAccessibleProjects(uid) {
  const snap = await db.collection('projects').where('accessibleUids', 'array-contains', uid).get()
  return snap.docs
}

// ── Discord OAuth ──────────────────────────────────────────

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI
const IS_PROD = process.env.NODE_ENV === 'production'

// Validate FRONTEND_URL at startup against the allow-list. Prevents open-redirect
// if the env var is misconfigured or attacker-influenced — every OAuth redirect
// target is now guaranteed to be a known origin.
function resolveFrontendUrl() {
  const raw = process.env.FRONTEND_URL || 'http://localhost:5173'
  let parsed
  try { parsed = new URL(raw) } catch { throw new Error(`FRONTEND_URL is not a valid URL: ${raw}`) }
  if (IS_PROD && parsed.protocol !== 'https:') {
    throw new Error(`FRONTEND_URL must be https:// in production (got ${parsed.protocol}//)`)
  }
  const origin = parsed.origin
  if (!ALLOWED_ORIGINS.has(origin)) {
    throw new Error(`FRONTEND_URL origin ${origin} is not in ALLOWED_ORIGINS. Add it via EXTRA_ALLOWED_ORIGINS or the hard-coded list.`)
  }
  return raw.replace(/\/$/, '')
}
const FRONTEND_URL = resolveFrontendUrl()

// Same check for the OAuth redirect back from Discord.
if (DISCORD_REDIRECT_URI) {
  try {
    const u = new URL(DISCORD_REDIRECT_URI)
    if (IS_PROD && u.protocol !== 'https:') {
      throw new Error(`DISCORD_REDIRECT_URI must be https:// in production (got ${u.protocol}//)`)
    }
  } catch (err) {
    throw new Error(`DISCORD_REDIRECT_URI is invalid: ${err.message}`)
  }
}

// CSRF state store for OAuth: maps state -> { expiresAt }. 10-min TTL, single-use.
const oauthStates = new Map()
// One-time code store for token exchange: maps code -> { uid, expiresAt }. 60s TTL, single-use.
const oauthCodes = new Map()

function purgeExpired(map) {
  const now = Date.now()
  for (const [k, v] of map) if (v.expiresAt < now) map.delete(k)
}
setInterval(() => { purgeExpired(oauthStates); purgeExpired(oauthCodes) }, 60 * 1000).unref()

app.get('/auth/discord', (req, res) => {
  const state = crypto.randomBytes(24).toString('hex')
  oauthStates.set(state, { expiresAt: Date.now() + 10 * 60 * 1000 })
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email',
    state,
  })
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`)
})

app.get('/auth/discord/callback', async (req, res) => {
  const { code, state } = req.query
  if (!code || !state) return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`)

  // Verify + consume CSRF state (single-use).
  const entry = oauthStates.get(state)
  oauthStates.delete(state)
  if (!entry || entry.expiresAt < Date.now()) {
    return res.redirect(`${FRONTEND_URL}/login?error=oauth_state`)
  }

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

    // Require a verified email so unverified addresses can't squat real accounts.
    if (discordUser.email && discordUser.verified !== true) {
      return res.redirect(`${FRONTEND_URL}/login?error=email_unverified`)
    }

    // Defence in depth: Discord sends numeric ids and hex avatar hashes, but we validate
    // before interpolating into a URL so a malformed / malicious response can't inject.
    const DISCORD_ID_RE = /^[0-9]{1,32}$/
    const DISCORD_HASH_RE = /^a?_?[a-f0-9]{1,64}$/i
    if (!DISCORD_ID_RE.test(String(discordUser.id || ''))) {
      return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`)
    }
    const uid = `discord_${discordUser.id}`
    const safeAvatarHash = typeof discordUser.avatar === 'string' && DISCORD_HASH_RE.test(discordUser.avatar)
      ? discordUser.avatar
      : null
    const fallbackIdx = Math.abs(parseInt(discordUser.discriminator, 10) || 0) % 5
    const avatarUrl = safeAvatarHash
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${safeAvatarHash}.png`
      : `https://cdn.discordapp.com/embed/avatars/${fallbackIdx}.png`

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

    // Issue a one-time code. Frontend POSTs it to /auth/exchange to get a custom token.
    // This keeps the token out of URLs / browser history / Referer headers / server logs.
    const oneTimeCode = crypto.randomBytes(32).toString('hex')
    oauthCodes.set(oneTimeCode, { uid, expiresAt: Date.now() + 60 * 1000 })
    res.redirect(`${FRONTEND_URL}/auth/callback?code=${oneTimeCode}`)
  } catch (err) {
    console.error('Discord OAuth error:', err)
    res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`)
  }
})

// Exchange one-time code for a Firebase custom token (single-use, 60s TTL).
app.post('/auth/exchange', exchangeLimiter, async (req, res) => {
  const { code } = req.body || {}
  if (!code || typeof code !== 'string') return bad(res, 'code is required')
  const entry = oauthCodes.get(code)
  oauthCodes.delete(code)
  if (!entry || entry.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'Invalid or expired code' })
  }
  const customToken = await admin.auth().createCustomToken(entry.uid)
  res.json({ token: customToken })
})

// ── Current user endpoint ──────────────────────────────────

app.get('/api/me', requireAuth, async (req, res) => {
  const doc = await db.collection('users').doc(req.user.uid).get()
  if (!doc.exists) return res.status(404).json({ error: 'User not found' })
  res.json({ uid: req.user.uid, ...doc.data() })
})

// Only allow safe URL schemes for images — blocks javascript:, data:, etc.
function isSafeHttpUrl(value) {
  if (typeof value !== 'string') return false
  try {
    const u = new URL(value)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

app.put('/api/me', requireAuth, async (req, res) => {
  const { displayName, bio, timezone, photoURL } = req.body
  if (photoURL !== undefined && photoURL !== null && photoURL !== '' && !isSafeHttpUrl(photoURL)) {
    return bad(res, 'photoURL must be a valid http(s) URL')
  }
  const update = {
    ...(typeof displayName === 'string' && displayName.trim() && { displayName: displayName.trim().slice(0, 100) }),
    ...(typeof bio === 'string' && { bio: bio.slice(0, 500) }),
    ...(typeof timezone === 'string' && { timezone: timezone.slice(0, 64) }),
    ...(photoURL !== undefined && { photoURL: photoURL || null }),
    updatedAt: new Date().toISOString(),
  }
  await db.collection('users').doc(req.user.uid).set(update, { merge: true })
  res.json({ uid: req.user.uid, ...update })
})

// ── Users list ─────────────────────────────────────────────

app.get('/api/users', requireAuth, async (req, res) => {
  const snap = await db.collection('users').get()
  const admin = isAppAdmin(req)
  res.json(snap.docs.map(d => ({
    uid: d.id,
    displayName: d.data().displayName,
    photoURL: d.data().photoURL,
    role: d.data().role,
    // Email only visible to admins — prevents enumeration / privacy leakage.
    ...(admin && { email: d.data().email }),
  })))
})

const APP_ROLES = new Set(['admin', 'manager', 'employee'])

app.put('/api/users/:uid/role', requireAuth, async (req, res) => {
  if (!isAppAdmin(req)) return res.status(403).json({ error: 'App admin role required' })
  const { role } = req.body
  if (!role || !APP_ROLES.has(role)) return bad(res, `role must be one of: ${[...APP_ROLES].join(', ')}`)
  if (req.params.uid === req.user.uid) return bad(res, 'Cannot change your own role')
  const userDoc = await db.collection('users').doc(req.params.uid).get()
  if (!userDoc.exists) return res.status(404).json({ error: 'User not found' })
  await db.collection('users').doc(req.params.uid).update({ role })
  invalidateAppRole(req.params.uid)
  res.json({ uid: req.params.uid, role })
})

// ── Projects ──────────────────────────────────────────────

app.get('/api/projects', requireAuth, async (req, res) => {
  if (isAppAdmin(req)) {
    const snap = await db.collection('projects').get()
    return res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }
  const docs = await listAccessibleProjects(req.user.uid)
  res.json(docs.map(d => ({ id: d.id, ...d.data() })))
})

app.get('/api/projects/:id', requireAuth, async (req, res) => {
  const doc = await db.collection('projects').doc(req.params.id).get()
  if (!doc.exists) return res.status(404).json({ error: 'Not found' })
  if (!isAppAdmin(req) && !canAccessProject(req.user.uid, doc.data())) return res.status(403).json({ error: 'Forbidden' })
  res.json({ id: doc.id, ...doc.data() })
})

// Allow-listed fields for project create/update. Never spread raw req.body.
function pickProjectFields(body) {
  const out = {}
  if (typeof body.name === 'string') out.name = body.name.trim().slice(0, 200)
  if (typeof body.description === 'string') out.description = body.description.slice(0, 2000)
  if (typeof body.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.color)) out.color = body.color
  if (Array.isArray(body.memberIds)) out.memberIds = body.memberIds.filter(x => typeof x === 'string').slice(0, 200)
  if (Array.isArray(body.columns)) {
    out.columns = body.columns
      .filter(c => c && typeof c === 'object' && typeof c.key === 'string' && typeof c.label === 'string')
      .slice(0, 20)
      .map(c => ({
        key: c.key.trim().slice(0, 60),
        label: c.label.trim().slice(0, 60),
        color: typeof c.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : '#9ca3af',
      }))
      .filter(c => c.key && c.label)
  }
  return out
}

app.post('/api/projects', requireAuth, async (req, res) => {
  const picked = pickProjectFields(req.body || {})
  if (!picked.name) return bad(res, 'name is required')
  const id = uuid()
  const project = {
    description: '',
    color: '#388bfd',
    memberIds: [],
    ...picked,
    roles: { [req.user.uid]: 'admin' },
    accessibleUids: [req.user.uid],
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
  const role = getUserProjectRole(req.user.uid, doc.data())
  if (!isAppAdmin(req) && !hasRole(role, 'manager')) return res.status(403).json({ error: 'Forbidden' })
  // Allow-list fields — never trust raw req.body (mass-assignment prevention).
  const safeBody = pickProjectFields(req.body || {})
  if (Object.keys(safeBody).length === 0) return bad(res, 'No valid fields to update')
  await ref.update(safeBody)
  res.json({ id: req.params.id, ...doc.data(), ...safeBody })
})

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  const ref = db.collection('projects').doc(req.params.id)
  const doc = await ref.get()
  if (!doc.exists) return res.status(404).json({ error: 'Not found' })
  const role = getUserProjectRole(req.user.uid, doc.data())
  if (!isAppAdmin(req) && !hasRole(role, 'admin')) return res.status(403).json({ error: 'Forbidden' })
  const taskSnap = await db.collection('tasks').where('projectId', '==', req.params.id).get()
  const noteSnap = await db.collection('notes').where('projectId', '==', req.params.id).get()
  const batch = db.batch()
  taskSnap.docs.forEach(d => batch.delete(d.ref))
  noteSnap.docs.forEach(d => batch.delete(d.ref))
  batch.delete(ref)
  await batch.commit()
  res.json({ ok: true })
})

// ── Project members (roles) ────────────────────────────────

app.get('/api/projects/:id/members', requireAuth, async (req, res) => {
  const ref = db.collection('projects').doc(req.params.id)
  const doc = await ref.get()
  if (!doc.exists) return res.status(404).json({ error: 'Not found' })
  const data = doc.data()
  const role = getUserProjectRole(req.user.uid, data)
  if (!isAppAdmin(req) && !role) return res.status(403).json({ error: 'Forbidden' })
  const roles = { ...data.roles }
  // Migrate legacy projects: if the creator isn't in the roles map, add them now
  if (data.createdBy && !roles[data.createdBy]) {
    roles[data.createdBy] = 'admin'
    await ref.update({
      [`roles.${data.createdBy}`]: 'admin',
      accessibleUids: FieldValue.arrayUnion(data.createdBy),
    })
  }
  const uids = Object.keys(roles)
  if (uids.length === 0) return res.json([])
  const userDocs = await Promise.all(uids.map(uid => db.collection('users').doc(uid).get()))
  const members = userDocs.map((d, i) => ({
    uid: uids[i],
    role: roles[uids[i]],
    displayName: d.exists ? d.data().displayName : uids[i],
    email: d.exists ? d.data().email : null,
    photoURL: d.exists ? d.data().photoURL : null,
  }))
  res.json(members)
})

app.post('/api/projects/:id/members', requireAuth, async (req, res) => {
  const { uid, role } = req.body
  if (!uid || typeof uid !== 'string') return bad(res, 'uid is required')
  if (!role || !VALID_ROLES.has(role)) return bad(res, `role must be one of: ${[...VALID_ROLES].join(', ')}`)
  const ref = db.collection('projects').doc(req.params.id)
  const [doc, targetUser] = await Promise.all([
    ref.get(),
    db.collection('users').doc(uid).get(),
  ])
  if (!doc.exists) return res.status(404).json({ error: 'Not found' })
  if (!targetUser.exists) return res.status(404).json({ error: 'User not found' })
  const myRole = getUserProjectRole(req.user.uid, doc.data())
  if (!isAppAdmin(req) && !hasRole(myRole, 'manager')) return res.status(403).json({ error: 'Forbidden' })
  if (!isAppAdmin(req) && !hasRole(myRole, 'admin') && hasRole(role, 'manager')) {
    return res.status(403).json({ error: 'Only admins can assign manager or admin roles' })
  }
  const existingRoles = doc.data().roles || {}
  const updates = {
    [`roles.${uid}`]: role,
    accessibleUids: FieldValue.arrayUnion(uid),
  }
  // Migrate legacy projects: write the creator into the roles map if not already there
  if (doc.data().createdBy && !existingRoles[doc.data().createdBy]) {
    updates[`roles.${doc.data().createdBy}`] = 'admin'
    updates.accessibleUids = FieldValue.arrayUnion(uid, doc.data().createdBy)
  }
  await ref.update(updates)
  res.json({ uid, role })
})

app.put('/api/projects/:id/members/:uid', requireAuth, async (req, res) => {
  const { role } = req.body
  if (!role || !VALID_ROLES.has(role)) return bad(res, `role must be one of: ${[...VALID_ROLES].join(', ')}`)
  const ref = db.collection('projects').doc(req.params.id)
  const doc = await ref.get()
  if (!doc.exists) return res.status(404).json({ error: 'Not found' })
  const myRole = getUserProjectRole(req.user.uid, doc.data())
  if (!isAppAdmin(req) && !hasRole(myRole, 'admin')) return res.status(403).json({ error: 'Only admins can change roles' })
  if (req.params.uid === req.user.uid) return bad(res, 'Cannot change your own role')
  await ref.update({ [`roles.${req.params.uid}`]: role })
  res.json({ uid: req.params.uid, role })
})

app.delete('/api/projects/:id/members/:uid', requireAuth, async (req, res) => {
  const ref = db.collection('projects').doc(req.params.id)
  const doc = await ref.get()
  if (!doc.exists) return res.status(404).json({ error: 'Not found' })
  const myRole = getUserProjectRole(req.user.uid, doc.data())
  if (!isAppAdmin(req) && !hasRole(myRole, 'admin')) return res.status(403).json({ error: 'Only admins can remove members' })
  const roles = doc.data().roles || {}
  const adminCount = Object.values(roles).filter(r => r === 'admin').length
  if (req.params.uid === req.user.uid && adminCount <= 1) {
    return bad(res, 'Cannot remove yourself as the only admin')
  }
  await ref.update({
    [`roles.${req.params.uid}`]: FieldValue.delete(),
    accessibleUids: FieldValue.arrayRemove(req.params.uid),
  })
  res.json({ ok: true })
})

// ── Tasks ──────────────────────────────────────────────────

app.get('/api/tasks', requireAuth, async (req, res) => {
  let query = db.collection('tasks')
  if (req.query.projectId) query = query.where('projectId', '==', req.query.projectId)
  if (isAppAdmin(req)) {
    const snap = await query.get()
    return res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }
  const uid = req.user.uid
  const accessibleDocs = await listAccessibleProjects(uid)
  const accessibleIds = new Set(accessibleDocs.map(d => d.id))
  if (req.query.projectId && !accessibleIds.has(req.query.projectId)) return res.json([])
  const snap = await query.get()
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => accessibleIds.has(t.projectId)))
})

const VALID_STATUSES = new Set(['todo', 'in_progress', 'done'])

// Allow-listed fields for task create/update.
function pickTaskFields(body) {
  const out = {}
  if (typeof body.title === 'string') out.title = body.title.trim().slice(0, 300)
  if (typeof body.description === 'string') out.description = cleanRichText(body.description.slice(0, 20000))
  if (typeof body.status === 'string' && VALID_STATUSES.has(body.status)) out.status = body.status
  if (typeof body.priority === 'string' && VALID_PRIORITIES.has(body.priority)) out.priority = body.priority
  if (body.parentId === null || typeof body.parentId === 'string') out.parentId = body.parentId
  if (Array.isArray(body.assigneeIds)) out.assigneeIds = body.assigneeIds.filter(x => typeof x === 'string').slice(0, 50)
  if (body.dueDate === null) {
    out.dueDate = null
  } else if (typeof body.dueDate === 'string') {
    // Accept only ISO 8601 date/datetime strings (YYYY-MM-DD or YYYY-MM-DDTHH:mm…).
    const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/
    if (ISO_DATE_RE.test(body.dueDate) && !isNaN(Date.parse(body.dueDate))) {
      out.dueDate = body.dueDate
    }
  }
  if (Array.isArray(body.links)) {
    out.links = body.links
      .filter(l => l && typeof l === 'object')
      .slice(0, 20)
      .map(l => {
        if (typeof l.url !== 'string') return null
        try {
          const u = new URL(l.url)
          if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
          return {
            url: u.href,
            label: typeof l.label === 'string' ? l.label.trim().slice(0, 200) : u.href,
          }
        } catch { return null }
      })
      .filter(Boolean)
  }
  return out
}

app.post('/api/tasks', requireAuth, async (req, res) => {
  const { projectId } = req.body || {}
  if (!projectId || typeof projectId !== 'string') return bad(res, 'projectId is required')
  const picked = pickTaskFields(req.body || {})
  if (!picked.title) return bad(res, 'title is required')
  const projectDoc = await db.collection('projects').doc(projectId).get()
  if (!projectDoc.exists) return res.status(404).json({ error: 'Project not found' })
  const projectRole = getUserProjectRole(req.user.uid, projectDoc.data())
  if (!isAppAdmin(req) && !hasRole(projectRole, 'member')) return res.status(403).json({ error: 'Forbidden' })
  if (picked.parentId) {
    const parentDoc = await db.collection('tasks').doc(picked.parentId).get()
    if (!parentDoc.exists) return bad(res, 'parentId not found')
    if (parentDoc.data().projectId !== projectId) return bad(res, 'parentId belongs to a different project')
    if (parentDoc.data().parentId) return bad(res, 'subtasks cannot have subtasks')
  }
  const id = uuid()
  const task = {
    projectId,
    parentId: null,
    description: '',
    status: 'todo',
    priority: 'medium',
    assigneeIds: [],
    dueDate: null,
    completedAt: null,
    ...picked,
    createdAt: new Date().toISOString(),
    createdBy: req.user.uid,
    createdByName: req.user.name || req.user.email || 'Unknown',
  }
  await db.collection('tasks').doc(id).set(task)
  res.json({ id, ...task })

  const assignedIds = task.assigneeIds || []
  if (assignedIds.length) {
    notifyAssignment({
      addedMemberIds: assignedIds,
      task: { ...task, projectId },
      projectName: projectDoc.data().name || 'Unknown Project',
      assignedByName: req.user.name || req.user.email || 'Someone',
    }).catch(err => console.error('[notify] task create:', err))
  }
})

app.put('/api/tasks/:id', requireAuth, async (req, res) => {
  const ref = db.collection('tasks').doc(req.params.id)
  const doc = await ref.get()
  if (!doc.exists) return res.status(404).json({ error: 'Not found' })
  const task = doc.data()
  const projectDoc = await db.collection('projects').doc(task.projectId).get()
  const projectRole = projectDoc.exists ? getUserProjectRole(req.user.uid, projectDoc.data()) : null
  if (!isAppAdmin(req) && !hasRole(projectRole, 'member') && task.createdBy !== req.user.uid) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const safeBody = pickTaskFields(req.body || {})
  if (Object.keys(safeBody).length === 0) return bad(res, 'No valid fields to update')
  if (safeBody.parentId) {
    if (safeBody.parentId === req.params.id) return bad(res, 'task cannot be its own parent')
    const parentDoc = await db.collection('tasks').doc(safeBody.parentId).get()
    if (!parentDoc.exists) return bad(res, 'parentId not found')
    if (parentDoc.data().projectId !== task.projectId) return bad(res, 'parentId belongs to a different project')
    if (parentDoc.data().parentId) return bad(res, 'subtasks cannot have subtasks')
  }
  const completedAtUpdate = {}
  if (safeBody.status === 'done' && !task.completedAt) {
    completedAtUpdate.completedAt = new Date().toISOString()
  } else if (safeBody.status && safeBody.status !== 'done') {
    completedAtUpdate.completedAt = null
  }
  const patch = { ...safeBody, ...completedAtUpdate }
  await ref.update(patch)
  const updated = { ...task, ...patch }
  res.json({ id: req.params.id, ...updated })

  if (safeBody.assigneeIds) {
    const oldSet = new Set(task.assigneeIds || [])
    const addedIds = safeBody.assigneeIds.filter(id => !oldSet.has(id))
    if (addedIds.length) {
      notifyAssignment({
        addedMemberIds: addedIds,
        task: updated,
        projectName: projectDoc.exists ? projectDoc.data().name : 'Unknown Project',
        assignedByName: req.user.name || req.user.email || 'Someone',
      }).catch(err => console.error('[notify] task update:', err))
    }
  }
})

app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
  const taskRef = db.collection('tasks').doc(req.params.id)
  const taskDoc = await taskRef.get()
  if (!taskDoc.exists) return res.status(404).json({ error: 'Not found' })
  const task = taskDoc.data()
  const projectDoc = await db.collection('projects').doc(task.projectId).get()
  const projectRole = projectDoc.exists ? getUserProjectRole(req.user.uid, projectDoc.data()) : null
  if (!isAppAdmin(req) && !hasRole(projectRole, 'manager') && task.createdBy !== req.user.uid) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  // Atomic delete: fetch children first, then delete task + subtasks + all comments
  // in a single batch so a partial failure can't leave orphan rows.
  const [subSnap, commentSnap] = await Promise.all([
    db.collection('tasks').where('parentId', '==', req.params.id).get(),
    db.collection('comments').where('taskId', '==', req.params.id).get(),
  ])
  // Also collect comments belonging to subtasks so none are orphaned.
  const subIds = subSnap.docs.map(d => d.id)
  let subCommentDocs = []
  for (let i = 0; i < subIds.length; i += 30) {
    const chunk = subIds.slice(i, i + 30)
    const snap = await db.collection('comments').where('taskId', 'in', chunk).get()
    subCommentDocs.push(...snap.docs)
  }
  const batch = db.batch()
  batch.delete(taskRef)
  subSnap.docs.forEach(d => batch.delete(d.ref))
  commentSnap.docs.forEach(d => batch.delete(d.ref))
  subCommentDocs.forEach(d => batch.delete(d.ref))
  await batch.commit()
  res.json({ ok: true })
})

// ── Members ────────────────────────────────────────────────

app.get('/api/members', requireAuth, async (req, res) => {
  const snap = await db.collection('members').get()
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
})

// Allow-listed fields for member create/update.
function pickMemberFields(body) {
  const out = {}
  if (typeof body.name === 'string') out.name = body.name.trim().slice(0, 200)
  if (typeof body.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.color)) out.color = body.color
  if (typeof body.role === 'string') out.role = body.role.slice(0, 100)
  if (typeof body.discordId === 'string') out.discordId = body.discordId.trim().slice(0, 100)
  return out
}

app.post('/api/members', requireAuth, async (req, res) => {
  const picked = pickMemberFields(req.body || {})
  if (!picked.name) return bad(res, 'name is required')
  const id = uuid()
  const member = {
    color: '#388bfd',
    role: '',
    discordId: '',
    ...picked,
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
  if (doc.data().createdBy !== req.user.uid && !isAppAdmin(req)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const safeBody = pickMemberFields(req.body || {})
  if (Object.keys(safeBody).length === 0) return bad(res, 'No valid fields to update')
  await ref.update(safeBody)
  res.json({ id: req.params.id, ...doc.data(), ...safeBody })
})

app.delete('/api/members/:id', requireAuth, async (req, res) => {
  const memberId = req.params.id
  const memberDoc = await db.collection('members').doc(memberId).get()
  if (!memberDoc.exists) return res.status(404).json({ error: 'Not found' })
  if (memberDoc.data().createdBy !== req.user.uid && !isAppAdmin(req)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  await db.collection('members').doc(memberId).delete()
  const arraySnap = await db.collection('tasks').where('assigneeIds', 'array-contains', memberId).get()
  const batch = db.batch()
  arraySnap.docs.forEach(d => batch.update(d.ref, { assigneeIds: FieldValue.arrayRemove(memberId) }))
  if (arraySnap.size > 0) await batch.commit()
  res.json({ ok: true })
})

// ── Notes ──────────────────────────────────────────────────

app.get('/api/notes', requireAuth, async (req, res) => {
  let query = db.collection('notes')
  if (req.query.projectId) query = query.where('projectId', '==', req.query.projectId)
  if (isAppAdmin(req)) {
    const snap = await query.get()
    return res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }
  const uid = req.user.uid
  const accessibleDocs = await listAccessibleProjects(uid)
  const accessibleIds = new Set(accessibleDocs.map(d => d.id))
  if (req.query.projectId && !accessibleIds.has(req.query.projectId)) return res.json([])
  const snap = await query.get()
  res.json(
    snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(n => !n.projectId ? n.createdBy === uid : accessibleIds.has(n.projectId))
  )
})

// Allow-listed fields for notes create/update.
function pickNoteFields(body) {
  const out = {}
  if (typeof body.title === 'string') out.title = body.title.trim().slice(0, 300)
  if (typeof body.content === 'string') out.content = cleanRichText(body.content.slice(0, 50000))
  return out
}

app.post('/api/notes', requireAuth, async (req, res) => {
  const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId : null
  const picked = pickNoteFields(req.body || {})
  if (!picked.title) return bad(res, 'title is required')
  if (projectId) {
    const projectDoc = await db.collection('projects').doc(projectId).get()
    if (!projectDoc.exists) return res.status(404).json({ error: 'Project not found' })
    const projectRole = getUserProjectRole(req.user.uid, projectDoc.data())
    if (!isAppAdmin(req) && !hasRole(projectRole, 'member')) return res.status(403).json({ error: 'Forbidden' })
  }
  const id = uuid()
  const note = {
    projectId,
    content: '',
    ...picked,
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
  const note = doc.data()
  if (note.projectId) {
    const projectDoc = await db.collection('projects').doc(note.projectId).get()
    if (!projectDoc.exists) return res.status(403).json({ error: 'Forbidden' })
    const projectRole = getUserProjectRole(req.user.uid, projectDoc.data())
    if (!isAppAdmin(req) && !hasRole(projectRole, 'member') && note.createdBy !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' })
    }
  }
  const safeNoteBody = pickNoteFields(req.body || {})
  if (Object.keys(safeNoteBody).length === 0) return bad(res, 'No valid fields to update')
  const patch = { ...safeNoteBody, updatedAt: new Date().toISOString() }
  await ref.update(patch)
  res.json({ id: req.params.id, ...note, ...patch })
})

app.delete('/api/notes/:id', requireAuth, async (req, res) => {
  const doc = await db.collection('notes').doc(req.params.id).get()
  if (!doc.exists) return res.status(404).json({ error: 'Not found' })
  const note = doc.data()
  if (note.projectId) {
    const projectDoc = await db.collection('projects').doc(note.projectId).get()
    if (!projectDoc.exists) return res.status(403).json({ error: 'Forbidden' })
    const projectRole = getUserProjectRole(req.user.uid, projectDoc.data())
    if (!isAppAdmin(req) && !hasRole(projectRole, 'manager') && note.createdBy !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' })
    }
  }
  await db.collection('notes').doc(req.params.id).delete()
  res.json({ ok: true })
})

// ── Comments ───────────────────────────────────────────────

app.get('/api/comments', requireAuth, async (req, res) => {
  // IDOR fix: require taskId, then verify caller has access to the parent project.
  const { taskId } = req.query
  if (!taskId || typeof taskId !== 'string') return bad(res, 'taskId query param is required')
  const taskDoc = await db.collection('tasks').doc(taskId).get()
  if (!taskDoc.exists) return res.status(404).json({ error: 'Task not found' })
  const task = taskDoc.data()
  const projectDoc = await db.collection('projects').doc(task.projectId).get()
  const projectRole = projectDoc.exists ? getUserProjectRole(req.user.uid, projectDoc.data()) : null
  if (!isAppAdmin(req) && !projectRole) return res.status(403).json({ error: 'Forbidden' })
  const snap = await db.collection('comments').where('taskId', '==', taskId).get()
  const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  res.json(comments)
})

app.post('/api/comments', requireAuth, async (req, res) => {
  const { taskId, content } = req.body
  if (!taskId || typeof taskId !== 'string') return bad(res, 'taskId is required')
  if (!content || typeof content !== 'string' || !content.trim()) return bad(res, 'content is required')
  const taskDoc = await db.collection('tasks').doc(taskId).get()
  if (!taskDoc.exists) return res.status(404).json({ error: 'Task not found' })
  const projectDoc = await db.collection('projects').doc(taskDoc.data().projectId).get()
  const projectRole = projectDoc.exists ? getUserProjectRole(req.user.uid, projectDoc.data()) : null
  if (!isAppAdmin(req) && !hasRole(projectRole, 'member')) return res.status(403).json({ error: 'Forbidden' })
  const id = uuid()
  // Comments are plain text — strip ALL HTML (no allowed tags). Enforces 2KB cap.
  const cleanContent = sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} }).trim().slice(0, 2000)
  if (!cleanContent) return bad(res, 'content is required')
  const comment = {
    taskId,
    content: cleanContent,
    authorName: req.user.name || req.user.email || 'Unknown',
    authorUid: req.user.uid,
    createdAt: new Date().toISOString(),
  }
  await db.collection('comments').doc(id).set(comment)
  res.json({ id, ...comment })
})

app.delete('/api/comments/:id', requireAuth, async (req, res) => {
  const doc = await db.collection('comments').doc(req.params.id).get()
  if (!doc.exists) return res.status(404).json({ error: 'Not found' })
  const comment = doc.data()
  if (comment.authorUid !== req.user.uid) {
    const taskDoc = await db.collection('tasks').doc(comment.taskId).get()
    if (!taskDoc.exists) return res.status(403).json({ error: 'Forbidden' })
    const projectDoc = await db.collection('projects').doc(taskDoc.data().projectId).get()
    const projectRole = projectDoc.exists ? getUserProjectRole(req.user.uid, projectDoc.data()) : null
    if (!isAppAdmin(req) && !hasRole(projectRole, 'manager')) return res.status(403).json({ error: 'Forbidden' })
  }
  await db.collection('comments').doc(req.params.id).delete()
  res.json({ ok: true })
})

// Generic error handler — don't leak stack traces / internals to clients.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  if (res.headersSent) return
  res.status(500).json({ error: 'Internal server error' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`))
