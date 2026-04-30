// One-shot migration: collapse legacy `assigneeId` into `assigneeIds[]` and
// delete the legacy field. Idempotent — safe to re-run.
//
// Usage: node server/scripts/migrate-assignees.js [--dry]

import 'dotenv/config'
import admin from 'firebase-admin'
import { db } from '../db.js'

const { FieldValue } = admin.firestore
const DRY = process.argv.includes('--dry')
const BATCH_SIZE = 400 // Firestore batch cap is 500; leave headroom.

async function run() {
  const snap = await db.collection('tasks').get()
  console.log(`Scanning ${snap.size} tasks (dry=${DRY})...`)

  let touched = 0
  let batch = db.batch()
  let inBatch = 0

  for (const doc of snap.docs) {
    const data = doc.data()
    const hasLegacy = Object.prototype.hasOwnProperty.call(data, 'assigneeId')
    if (!hasLegacy) continue

    const legacy = data.assigneeId
    const arr = Array.isArray(data.assigneeIds) ? data.assigneeIds : []
    const merged = legacy && !arr.includes(legacy) ? [...arr, legacy] : arr

    const update = { assigneeId: FieldValue.delete() }
    if (merged !== arr) update.assigneeIds = merged
    else if (!Array.isArray(data.assigneeIds)) update.assigneeIds = []

    if (!DRY) batch.update(doc.ref, update)
    touched++
    inBatch++

    if (inBatch >= BATCH_SIZE) {
      if (!DRY) await batch.commit()
      console.log(`  committed ${inBatch} (${touched} total)`)
      batch = db.batch()
      inBatch = 0
    }
  }

  if (inBatch > 0 && !DRY) await batch.commit()
  console.log(`Done. Touched ${touched} task(s).${DRY ? ' [DRY RUN]' : ''}`)
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
