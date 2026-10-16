import { reminderOccursOn } from '@/lib/recurrence';

// ---- date helpers (all local calendar dates as YYYY-MM-DD strings) ----
export function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromISO(iso) { return new Date(iso + 'T00:00:00'); }

// Weeks run Sunday–Saturday, matching the calendar grid.
export function periodRange(kind, anchorISO) {
  const a = fromISO(anchorISO);
  if (kind === 'month') {
    return { start: toISO(new Date(a.getFullYear(), a.getMonth(), 1)), end: toISO(new Date(a.getFullYear(), a.getMonth() + 1, 0)) };
  }
  const s = new Date(a); s.setDate(a.getDate() - a.getDay());
  const e = new Date(s); e.setDate(s.getDate() + 6);
  return { start: toISO(s), end: toISO(e) };
}

export function shiftAnchor(kind, anchorISO, dir) {
  const a = fromISO(anchorISO);
  if (kind === 'month') return toISO(new Date(a.getFullYear(), a.getMonth() + dir, 1));
  a.setDate(a.getDate() + 7 * dir);
  return toISO(a);
}

const SEVERITY_RANK = { mild: 1, moderate: 2, severe: 3 };

export function computeSummary(data, start, end, todayStr) {
  const lastDay = end < todayStr ? end : todayStr; // never count days that haven't happened yet
  const days = [];
  if (start <= lastDay) {
    for (let d = fromISO(start); toISO(d) <= lastDay; d.setDate(d.getDate() + 1)) days.push(toISO(d));
  }

  // Recurring reminders / medicines: how many were due vs ticked off.
  const reminders = (data.reminders || []).map((r) => {
    let due = 0, done = 0;
    for (const day of days) {
      if (reminderOccursOn(r, day)) {
        due++;
        if (Array.isArray(r.doneDates) && r.doneDates.includes(day)) done++;
      }
    }
    return { id: r.id, what: r.what, freq: r.freq, due, done };
  }).filter((r) => r.due > 0).sort((a, b) => b.due - a.due);
  const dueTotal = reminders.reduce((s, r) => s + r.due, 0);
  const doneTotal = reminders.reduce((s, r) => s + r.done, 0);

  // Symptoms grouped by name (case-insensitive).
  const bySymptom = new Map();
  const entries = (data.timeline || []).filter((t) => t.date >= start && t.date <= end && t.date <= todayStr);
  for (const t of entries) {
    const name = (t.what || 'Unnamed').trim();
    const key = name.toLowerCase();
    const sev = SEVERITY_RANK[t.severity] ? t.severity : 'mild';
    const row = bySymptom.get(key) || { name, count: 0, worst: 'mild', sum: 0 };
    row.count++;
    row.sum += SEVERITY_RANK[sev];
    if (SEVERITY_RANK[sev] > SEVERITY_RANK[row.worst]) row.worst = sev;
    bySymptom.set(key, row);
  }
  const symptoms = [...bySymptom.values()]
    .map((r) => ({ name: r.name, count: r.count, worst: r.worst, avg: r.sum / r.count }))
    .sort((a, b) => b.count - a.count || SEVERITY_RANK[b.worst] - SEVERITY_RANK[a.worst]);
  const severeDays = new Set(entries.filter((t) => t.severity === 'severe').map((t) => t.date)).size;

  // Appointments / check-ups: dates already passed count as attended.
  const inPeriod = (data.appointments || []).filter((a) => a.date >= start && a.date <= end);
  const attended = inPeriod.filter((a) => a.date <= todayStr).sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = inPeriod.filter((a) => a.date > todayStr).sort((a, b) => a.date.localeCompare(b.date));
  const byProvider = new Map();
  for (const a of attended) {
    const k = a.providerName || 'No provider listed';
    byProvider.set(k, (byProvider.get(k) || 0) + 1);
  }

  // Money tied to the period (by the date on each finance entry).
  const fin = (data.finance || []).filter((f) => f.date >= start && f.date <= end);
  const billed = fin.reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const paid = fin.filter((f) => f.status === 'paid').reduce((s, f) => s + (Number(f.amount) || 0), 0);

  return {
    start, end, dayCount: days.length,
    reminders, dueTotal, doneTotal,
    adherence: dueTotal > 0 ? Math.round((doneTotal / dueTotal) * 100) : null,
    symptoms, symptomEntries: entries.length, severeDays,
    attended, upcoming,
    providers: [...byProvider.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    finance: { count: fin.length, billed, paid, outstanding: billed - paid },
  };
}

// A compact, plain-text version of the stats — this is what gets sent to the
// AI if the person asks for a written summary (counts and names, no free-text notes).
export function summaryToText(s, label) {
  const lines = [`Period: ${label} (${s.start} to ${s.end})`];
  lines.push(`Reminders/medicines: ${s.doneTotal} of ${s.dueTotal} marked done${s.adherence !== null ? ` (${s.adherence}%)` : ''}.`);
  for (const r of s.reminders) lines.push(`- ${r.what}: ${r.done}/${r.due} (${r.freq})`);
  lines.push(`Symptom entries: ${s.symptomEntries}.`);
  for (const y of s.symptoms) lines.push(`- ${y.name}: ${y.count} time(s), worst severity ${y.worst}`);
  lines.push(`Appointments/check-ups attended: ${s.attended.length}; upcoming this period: ${s.upcoming.length}.`);
  for (const a of s.attended) lines.push(`- ${a.date}: ${a.what || 'Appointment'}${a.providerName ? ' with ' + a.providerName : ''}`);
  return lines.join('\n');
}
