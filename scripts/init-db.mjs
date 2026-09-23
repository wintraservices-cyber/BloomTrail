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

  // One row per person who can log in. Each user has their own username
  // and password — this is what keeps different people's health data apart.
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  // One row per "profile" (a person's journey). Every profile belongs to
  // exactly one user — a user can have several profiles (e.g. their own
  // and a parent's), but no profile is ever shared between users.
  await sql`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  // Migration: if this database was set up under the old single-PIN
  // version (profiles with no owner), add the user_id column now. Safe
  // to run repeatedly — IF NOT EXISTS makes this a no-op on fresh installs.
  await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;`;
  await sql`CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON profiles(user_id);`;

  const orphaned = await sql`SELECT COUNT(*)::int AS count FROM profiles WHERE user_id IS NULL;`;
  if (orphaned[0]?.count > 0) {
    console.log(
      `\nNote: ${orphaned[0].count} existing profile(s) have no owner (left over from the old single-PIN version).`
    );
    console.log(
      'They will not be visible to anyone until you either delete them or manually assign them to a user_id in the database.'
    );
  }

  console.log('Done. Tables ready.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
