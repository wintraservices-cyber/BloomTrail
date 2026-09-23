import { neon } from '@neondatabase/serverless';

// Vercel's Postgres integration (via the Neon marketplace) injects
// DATABASE_URL automatically. POSTGRES_URL is kept as a fallback for
// older-style Vercel Postgres projects.
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error(
    'No database connection string found. Set DATABASE_URL (or POSTGRES_URL) in your environment variables — see .env.example.'
  );
}
const sql = neon(connectionString);

export function defaultProfileData() {
  return {
    appointments: [],
    reminders: [],
    finance: [],
    providers: [],
    timeline: [],
    currency: '$',
  };
}

export async function listProfiles() {
  const rows = await sql`SELECT id, name FROM profiles ORDER BY created_at ASC;`;
  return rows;
}

export async function getProfileData(id) {
  const rows = await sql`SELECT data FROM profiles WHERE id = ${id};`;
  if (rows.length === 0) return null;
  return { ...defaultProfileData(), ...rows[0].data };
}

export async function createProfile(id, name) {
  await sql`
    INSERT INTO profiles (id, name, data)
    VALUES (${id}, ${name}, ${JSON.stringify(defaultProfileData())}::jsonb)
    ON CONFLICT (id) DO NOTHING;
  `;
}

export async function renameProfile(id, name) {
  await sql`UPDATE profiles SET name = ${name}, updated_at = now() WHERE id = ${id};`;
}

export async function deleteProfile(id) {
  await sql`DELETE FROM profiles WHERE id = ${id};`;
}

export async function saveProfileData(id, data) {
  await sql`
    UPDATE profiles
    SET data = ${JSON.stringify(data)}::jsonb, updated_at = now()
    WHERE id = ${id};
  `;
}

export async function ensureAtLeastOneProfile() {
  const profiles = await listProfiles();
  if (profiles.length === 0) {
    const id = crypto.randomUUID();
    await createProfile(id, 'My journey');
    return await listProfiles();
  }
  return profiles;
}
