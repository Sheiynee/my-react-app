import admin from 'firebase-admin'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

let serviceAccount

if (process.env.GOOGLE_CREDENTIALS) {
  serviceAccount = JSON.parse(process.env.GOOGLE_CREDENTIALS)
} else {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  serviceAccount = JSON.parse(
    readFileSync(join(__dirname, 'serviceAccountKey.json'), 'utf8')
  )
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  })
}

export const db = admin.firestore()
