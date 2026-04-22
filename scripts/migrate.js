#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const migrations = [
  // Thêm migration mới vào đây
]

async function migrate(sql) {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query(sql)
    console.log('✓ Migration OK')
  } catch (e) {
    console.error('✗ Error:', e.message)
  } finally {
    await client.end()
  }
}

const sql = process.argv[2]
if (!sql) {
  console.log('Usage: node scripts/migrate.js "ALTER TABLE ..."')
  process.exit(1)
}
migrate(sql)
