import admin from 'firebase-admin'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load service-account credentials from env in production. The file-based fallback
// is only allowed when ALLOW_SERVICE_ACCOUNT_FILE=1 (local dev). This prevents
// accidentally shipping serviceAccountKey.json in a container image / zip upload.
function loadServiceAccount() {
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      return JSON.parse(process.env.GOOGLE_CREDENTIALS)
    } catch (err) {
      throw new Error('GOOGLE_CREDENTIALS is set but is not valid JSON: ' + err.message)
    }
  }

  const isProd = process.env.NODE_ENV === 'production'
  const allowFile = process.env.ALLOW_SERVICE_ACCOUNT_FILE === '1'

  if (isProd && !allowFile) {
    throw new Error(
      'Missing GOOGLE_CREDENTIALS env var. Refusing to read serviceAccountKey.json in production. ' +
      'Set GOOGLE_CREDENTIALS, or set ALLOW_SERVICE_ACCOUNT_FILE=1 if you really must use the file.'
    )
  }

  const __dirname = dirname(fileURLToPath(import.meta.url))
  const keyPath = join(__dirname, 'serviceAccountKey.json')
  if (!existsSync(keyPath)) {
    throw new Error(
      'No credentials found: set GOOGLE_CREDENTIALS env var, or place serviceAccountKey.json in server/ for local dev.'
    )
  }
  console.warn('⚠️  Loading Firebase credentials from serviceAccountKey.json (dev only). Use GOOGLE_CREDENTIALS in production.')
  return JSON.parse(readFileSync(keyPath, 'utf8'))
}

const serviceAccount = loadServiceAccount()

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

export const db = admin.firestore()
