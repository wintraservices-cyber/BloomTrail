import { reminderOccursOn } from '@/lib/recurrence';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
// How long after its scheduled minute a notification may still go out. The
// scheduler can run late (e.g. GitHub Actions cron), but a 7am reminder
// arriving at noon is worse than none.
const LATE_MINUTES = 90;
const APPT_LEAD_MINUTES = 60;

export function localParts(now, tz) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now);
  } catch {
    return localParts(now, 'UTC');
  }
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

function toMinutes(t) {
  const m = TIME_RE.exec(t || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function fmt12(t) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// profiles: [{ id, name, data }]. Returns notifications that should go out now.
// Each has a `key` that is unique per item per local day (used for de-duping).
export function dueNotifications(profiles, now, tz) {
  const { date, minutes } = localParts(now, tz);
  const out = [];
  const multi = profiles.length > 1;

  for (const p of profiles) {
    const tag = multi ? ` (${p.name})` : '';
    for (const r of p.data.reminders || []) {
      const at = toMinutes(r.time);
      if (at === null || !reminderOccursOn(r, date)) continue;
      if (Array.isArray(r.doneDates) && r.doneDates.includes(date)) continue;
      if (minutes >= at && minutes - at <= LATE_MINUTES) {
        out.push({ key: `${p.id}:r:${r.id}:${date}`, title: `Reminder${tag}`, body: `${r.what} · ${fmt12(r.time)}`, url: '/' });
      }
    }
    for (const a of p.data.appointments || []) {
      const at = toMinutes(a.time);
      if (at === null || a.date !== date) continue;
      const notifyAt = at - APPT_LEAD_MINUTES;
      if (minutes >= notifyAt && minutes < at && minutes - notifyAt <= LATE_MINUTES) {
        const who = a.providerName ? ` with ${a.providerName}` : '';
        out.push({ key: `${p.id}:a:${a.id}:${date}`, title: `Appointment today${tag}`, body: `${a.what || 'Appointment'} at ${fmt12(a.time)}${who}`, url: '/' });
      }
    }
  }
  return out;
}
