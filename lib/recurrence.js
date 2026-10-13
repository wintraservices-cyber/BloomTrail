// Shared by the browser UI and the notification scheduler so both agree on
// which days a reminder falls on.
export function reminderOccursOn(rem, iso) {
  if (!rem.start) return false;
  const start = new Date(rem.start + 'T00:00:00');
  const target = new Date(iso + 'T00:00:00');
  if (target < start) return false;
  if (rem.end && target > new Date(rem.end + 'T00:00:00')) return false;
  if (rem.freq === 'daily') return true;
  if (rem.freq === 'weekly') return Math.round((target - start) / 86400000) % 7 === 0;
  if (rem.freq === 'monthly') return target.getDate() === start.getDate();
  return false;
}
