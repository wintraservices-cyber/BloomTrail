// Run this once after connecting a Postgres database to create the tables
// Bloom Trail needs. Usage:  npm run db:init
// Requires DATABASE_URL (or POSTGRES_URL) to be set in your environment —
// Vercel CLI's `vercel env pull .env.local` is the easiest way to get this
// locally after adding the Postgres/Neon integration in your project.

import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('No DATABASE_URL or POSTGRES_URL found in your environment.');
  console.error('Run `vercel env pull .env.local` first, or set it manually.');
  process.exit(1);
}
const sql = neon(connectionString);

async function main() {
  console.log('Creating tables if they do not already exist...');

  // One row per "profile" (person's journey). All their data is stored
  // as a single JSON blob for simplicity — this app doesn't need complex
  // relational queries, and it keeps the schema trivially easy to extend.
  await sql`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  console.log('Done. Tables ready.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
