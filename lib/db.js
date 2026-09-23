import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

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

// ---------- Users ----------

export async function getUserByUsername(username) {
  const rows = await sql`SELECT id, username, password_hash FROM users WHERE username = ${username};`;
  return rows[0] || null;
}

export async function getUserById(id) {
  const rows = await sql`SELECT id, username FROM users WHERE id = ${id};`;
  return rows[0] || null;
}

export async function countUsers() {
  const rows = await sql`SELECT COUNT(*)::int AS count FROM users;`;
  return rows[0]?.count ?? 0;
}

export async function createUser(id, username, password) {
  const passwordHash = await bcrypt.hash(password, 10);
  await sql`
    INSERT INTO users (id, username, password_hash)
    VALUES (${id}, ${username}, ${passwordHash});
  `;
  return { id, username };
}

export async function verifyUserPassword(username, password) {
  const user = await getUserByUsername(username);
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;
  return { id: user.id, username: user.username };
}

export async function setUserPassword(userId, newPassword) {
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId};`;
}

// ---------- Profiles (each owned by exactly one user) ----------

export async function listProfilesForUser(userId) {
  const rows = await sql`SELECT id, name FROM profiles WHERE user_id = ${userId} ORDER BY created_at ASC;`;
  return rows;
}

// Returns profile data only if it belongs to this user — callers must
// always pass the requesting user's id, never trust a bare profile id.
export async function getProfileDataForUser(id, userId) {
  const rows = await sql`SELECT data FROM profiles WHERE id = ${id} AND user_id = ${userId};`;
  if (rows.length === 0) return null;
  return { ...defaultProfileData(), ...rows[0].data };
}

export async function createProfileForUser(id, userId, name) {
  await sql`
    INSERT INTO profiles (id, user_id, name, data)
    VALUES (${id}, ${userId}, ${name}, ${JSON.stringify(defaultProfileData())}::jsonb)
    ON CONFLICT (id) DO NOTHING;
  `;
}

export async function renameProfileForUser(id, userId, name) {
  await sql`UPDATE profiles SET name = ${name}, updated_at = now() WHERE id = ${id} AND user_id = ${userId};`;
}

export async function deleteProfileForUser(id, userId) {
  await sql`DELETE FROM profiles WHERE id = ${id} AND user_id = ${userId};`;
}

export async function saveProfileDataForUser(id, userId, data) {
  await sql`
    UPDATE profiles
    SET data = ${JSON.stringify(data)}::jsonb, updated_at = now()
    WHERE id = ${id} AND user_id = ${userId};
  `;
}

export async function ensureAtLeastOneProfileForUser(userId) {
  const profiles = await listProfilesForUser(userId);
  if (profiles.length === 0) {
    const id = crypto.randomUUID();
    await createProfileForUser(id, userId, 'My journey');
    return await listProfilesForUser(userId);
  }
  return profiles;
}
