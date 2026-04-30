// One-shot backfill: populate `accessibleUids` on every project doc =
// union of `createdBy` and `Object.keys(roles)`. Safe to re-run.
//
// Run AFTER deploying the code that maintains the field on writes, otherwise
// new mutations will overwrite the backfilled value.
//
// Usage: node server/scripts/backfill-accessible-uids.js [--dry]

import 'dotenv/config'
import { db } from '../db.js'

const DRY = process.argv.includes('--dry')
const BATCH_SIZE = 400

function compute(data) {
  const set = new Set()
  if (data.createdBy) set.add(data.createdBy)
  if (data.roles) Object.keys(data.roles).forEach(uid => set.add(uid))
  return [...set]
}

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

async function run() {
  const snap = await db.collection('projects').get()
  console.log(`Scanning ${snap.size} projects (dry=${DRY})...`)

  let touched = 0
  let batch = db.batch()
  let inBatch = 0

  for (const doc of snap.docs) {
    const data = doc.data()
    const next = compute(data)
    if (arraysEqual(data.accessibleUids, next)) continue
    if (!DRY) batch.update(doc.ref, { accessibleUids: next })
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
  console.log(`Done. Touched ${touched} project(s).${DRY ? ' [DRY RUN]' : ''}`)
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
