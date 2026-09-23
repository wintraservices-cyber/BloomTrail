'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const CURRENCIES = [
  { value: '$', label: '$ — Dollar' },
  { value: '€', label: '€ — Euro' },
  { value: '£', label: '£ — Pound' },
  { value: '¥', label: '¥ — Yen' },
  { value: '₹', label: '₹ — Rupee' },
  { value: '₱', label: '₱ — Peso' },
  { value: '₩', label: '₩ — Won' },
  { value: 'R$', label: 'R$ — Real' },
  { value: 'C$', label: 'C$ — Canadian dollar' },
  { value: 'A$', label: 'A$ — Australian dollar' },
  { value: 'Fr', label: 'Fr — Franc' },
  { value: 'kr', label: 'kr — Krona/Krone' },
];

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function todayISO() {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

function fmtMoney(n, currency) {
  const v = Number(n) || 0;
  return (currency || '$') + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateBadge(iso) {
  if (!iso) return { mon: '—', day: '—' };
  const d = new Date(iso + 'T00:00:00');
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return { mon: months[d.getMonth()], day: d.getDate() };
}

function fmtDateLong(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + ':' + String(m).padStart(2, '0') + ' ' + ampm;
}

function initials(name) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

// ---------- .ics (calendar file) export ----------
// Building this by hand rather than pulling in a library — the format
// Bloom Trail needs (one VEVENT, optional RRULE) is small and stable.

function icsEscape(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Formats a JS Date as .ics "floating time" (no Z suffix, no timezone
// conversion): 20260401T090000. Calendar apps interpret this as local time
// on whatever device opens the file — the right behavior for "this
// appointment is at 2:30pm", which should stay 2:30pm regardless of the
// timezone the .ics happens to be generated or opened in.
function icsDateTimeFloating(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

function icsDateTimeUTC(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

// Formats a date-only value (no time component) as .ics wants: 20260401
function icsDateOnly(iso) {
  return iso.replace(/-/g, '');
}

function downloadIcsFile(filename, icsContent) {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildApptIcs(appt) {
  const uidStr = `bloom-trail-appt-${appt.id}@bloomtrail`;
  const now = icsDateTimeUTC(new Date());
  const title = icsEscape(appt.what || 'Appointment');
  const descParts = [];
  if (appt.providerName) descParts.push(`Provider: ${appt.providerName}`);
  if (appt.notes) descParts.push(appt.notes);
  const description = icsEscape(descParts.join('\\n\\n'));
  const location = icsEscape(appt.location || '');

  let dtStart, dtEnd;
  if (appt.time) {
    const start = new Date(`${appt.date}T${appt.time}:00`);
    const end = new Date(start.getTime() + 30 * 60000); // default 30 min
    dtStart = `DTSTART:${icsDateTimeFloating(start)}`;
    dtEnd = `DTEND:${icsDateTimeFloating(end)}`;
  } else {
    // All-day event when no specific time was set
    const startDate = icsDateOnly(appt.date);
    const endDateObj = new Date(appt.date + 'T00:00:00');
    endDateObj.setDate(endDateObj.getDate() + 1);
    const endDate = icsDateOnly(endDateObj.toISOString().slice(0, 10));
    dtStart = `DTSTART;VALUE=DATE:${startDate}`;
    dtEnd = `DTEND;VALUE=DATE:${endDate}`;
  }

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bloom Trail//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uidStr}`,
    `DTSTAMP:${now}`,
    dtStart,
    dtEnd,
    `SUMMARY:${title}`,
    description ? `DESCRIPTION:${description}` : null,
    location ? `LOCATION:${location}` : null,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${title}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

function buildReminderIcs(reminder) {
  const uidStr = `bloom-trail-reminder-${reminder.id}@bloomtrail`;
  const now = icsDateTimeUTC(new Date());
  const title = icsEscape(reminder.what || 'Reminder');
  const description = icsEscape(reminder.notes || '');
  const startDate = icsDateOnly(reminder.start);
  const endDateObj = new Date(reminder.start + 'T00:00:00');
  endDateObj.setDate(endDateObj.getDate() + 1);
  const endDate = icsDateOnly(endDateObj.toISOString().slice(0, 10));

  let rrule = null;
  if (reminder.freq === 'daily') rrule = 'RRULE:FREQ=DAILY';
  else if (reminder.freq === 'weekly') rrule = 'RRULE:FREQ=WEEKLY';
  else if (reminder.freq === 'monthly') rrule = 'RRULE:FREQ=MONTHLY';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bloom Trail//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uidStr}`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${startDate}`,
    `DTEND;VALUE=DATE:${endDate}`,
    rrule,
    `SUMMARY:${title}`,
    description ? `DESCRIPTION:${description}` : null,
    'BEGIN:VALARM',
    'TRIGGER:PT9H', // 9am reminder, since these are all-day events
    'ACTION:DISPLAY',
    `DESCRIPTION:${title}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

function slugForFilename(text) {
  return (text || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'event';
}

function defaultData() {
  return { appointments: [], reminders: [], finance: [], providers: [], timeline: [], currency: '$' };
}

function reminderOccursOn(rem, iso) {
  if (!rem.start) return false;
  const start = new Date(rem.start + 'T00:00:00');
  const target = new Date(iso + 'T00:00:00');
  if (target < start) return false;
  if (rem.freq === 'daily') return true;
  if (rem.freq === 'weekly') return Math.round((target - start) / 86400000) % 7 === 0;
  if (rem.freq === 'monthly') return target.getDate() === start.getDate();
  return false;
}

// Everything due "today" — used for both the calendar banner and the small
// badge on the Calendar tab, so the person notices without having to look.
function getTodaysDueItems(data) {
  const todayStr = todayISO();
  const appts = data.appointments.filter((a) => a.date === todayStr);
  const reminders = data.reminders.filter((r) => reminderOccursOn(r, todayStr));
  return { appts, reminders, total: appts.length + reminders.length };
}

export default function BloomTrailApp() {
  const router = useRouter();

  const [profiles, setProfiles] = useState([]);
  const [currentProfileId, setCurrentProfileId] = useState(null);
  const [data, setData] = useState(defaultData());
  const [view, setView] = useState('calendar');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [calCursor, setCalCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  const toastTimer = useRef(null);
  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1800);
  }

  const saveTimer = useRef(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  // Debounced save to the server whenever `data` changes.
  const persist = useCallback((profileId, nextData) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch(`/api/data/profiles/${profileId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: nextData }),
        });
      } catch (e) {
        showToast("Couldn't save — check your connection");
      }
    }, 500);
  }, []);

  function updateData(mutator) {
    setData((prev) => {
      const next = typeof mutator === 'function' ? mutator(structuredClone(prev)) : mutator;
      if (currentProfileId) persist(currentProfileId, next);
      return next;
    });
  }

  // ---------- Initial load ----------
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch('/api/data/profiles');
        if (resp.status === 401) { router.push('/login'); return; }
        const json = await resp.json();
        setProfiles(json.profiles || []);
        const lastId = localStorage.getItem('bloom-trail-last-profile');
        const validIds = (json.profiles || []).map((p) => p.id);
        const id = (lastId && validIds.includes(lastId)) ? lastId : json.profiles?.[0]?.id;
        if (id) await switchProfile(id, json.profiles);
      } catch (e) {
        showToast('Failed to load — check your connection');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function switchProfile(id, profilesList) {
    setCurrentProfileId(id);
    try { localStorage.setItem('bloom-trail-last-profile', id); } catch {}
    try {
      const resp = await fetch(`/api/data/profiles/${id}`);
      const json = await resp.json();
      setData({ ...defaultData(), ...(json.data || {}) });
    } catch (e) {
      showToast('Failed to load this profile');
    }
  }

  async function handleProfileChange(e) {
    await switchProfile(e.target.value, profiles);
  }

  async function addProfile() {
    const name = prompt('Name for this person\'s journey (e.g. "Mom", "My journey"):');
    if (!name || !name.trim()) return;
    try {
      const resp = await fetch('/api/data/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await resp.json();
      if (!resp.ok) { showToast(json.error || 'Failed to add profile'); return; }
      setProfiles(json.profiles);
      await switchProfile(json.id, json.profiles);
      showToast('Added ' + name.trim());
    } catch (e) {
      showToast('Failed to add profile');
    }
  }

  async function renameCurrentProfile() {
    const current = profiles.find((p) => p.id === currentProfileId);
    if (!current) return;
    const name = prompt('Rename this journey:', current.name);
    if (!name || !name.trim()) return;
    try {
      const resp = await fetch(`/api/data/profiles/${currentProfileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await resp.json();
      if (!resp.ok) { showToast(json.error || 'Failed to rename'); return; }
      setProfiles(json.profiles);
      showToast('Renamed to ' + name.trim());
    } catch (e) {
      showToast('Failed to rename profile');
    }
  }

  async function deleteCurrentProfile() {
    if (profiles.length <= 1) { showToast("Can't delete your only profile"); return; }
    const current = profiles.find((p) => p.id === currentProfileId);
    if (!current) return;
    if (!confirm(`Delete "${current.name}" and everything in it? This can't be undone.`)) return;
    try {
      const resp = await fetch(`/api/data/profiles/${currentProfileId}`, { method: 'DELETE' });
      const json = await resp.json();
      if (!resp.ok) { showToast(json.error || 'Failed to delete'); return; }
      setProfiles(json.profiles);
      await switchProfile(json.profiles[0].id, json.profiles);
      showToast('Profile deleted');
    } catch (e) {
      showToast('Failed to delete profile');
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-soft)' }}>
        Loading Bloom Trail…
      </div>
    );
  }

  return (
    <div className="shell">
      <Header
        profiles={profiles}
        currentProfileId={currentProfileId}
        onProfileChange={handleProfileChange}
        onAddProfile={addProfile}
        onRenameProfile={renameCurrentProfile}
        onDeleteProfile={deleteCurrentProfile}
        onLogout={handleLogout}
      />
      <Tabs view={view} setView={setView} dueCount={getTodaysDueItems(data).total} />

      {view === 'calendar' && (
        <CalendarView data={data} calCursor={calCursor} setCalCursor={setCalCursor} updateData={updateData} showToast={showToast} />
      )}
      {view === 'appointments' && (
        <AppointmentsView data={data} updateData={updateData} showToast={showToast} />
      )}
      {view === 'timeline' && (
        <TimelineView data={data} updateData={updateData} showToast={showToast} />
      )}
      {view === 'providers' && (
        <ProvidersView data={data} updateData={updateData} showToast={showToast} />
      )}
      {view === 'reminders' && (
        <RemindersView data={data} updateData={updateData} showToast={showToast} />
      )}
      {view === 'finance' && (
        <FinanceView data={data} updateData={updateData} showToast={showToast} />
      )}

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  );
}

// ==================== Header / Tabs ====================

function BloomIcon({ size = 34 }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Bloom Trail"
      style={{ flexShrink: 0, height: size, width: 'auto', objectFit: 'contain' }}
    />
  );
}

function Header({ profiles, currentProfileId, onProfileChange, onAddProfile, onRenameProfile, onDeleteProfile, onLogout }) {
  const [now] = useState(() => new Date());
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  return (
    <header className="top">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <BloomIcon />
        <div>
          <h1>Bloom Trail</h1>
          <div className="tagline">Every step of your medical journey, gathered in one place</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div className="today">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <select value={currentProfileId || ''} onChange={onProfileChange} style={{ width: 'auto', padding: '6px 26px 6px 10px', fontSize: 13 }}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button className="icon-btn" title="Add another journey to your own account (e.g. tracking a parent's care yourself)" onClick={onAddProfile} style={{ fontSize: 18, border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '4px 9px' }}>+</button>
          <button className="icon-btn" title="Rename this profile" onClick={onRenameProfile}>✎</button>
          <button className="icon-btn" title="Delete this profile" onClick={onDeleteProfile}>✕</button>
          <button
            className="ghost"
            onClick={() => setInviteModalOpen(true)}
            style={{ fontSize: 12, padding: '6px 10px' }}
            title="Generate a link that lets someone else create their own private account"
          >
            Invite someone
          </button>
          <button className="ghost" onClick={onLogout} style={{ fontSize: 12, padding: '6px 10px' }}>Log out</button>
        </div>
      </div>
      {inviteModalOpen && <InviteModal onClose={() => setInviteModalOpen(false)} />}
    </header>
  );
}

function InviteModal({ onClose }) {
  const [invites, setInvites] = useState([]);
  const [newLink, setNewLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function loadInvites() {
    setLoading(true);
    try {
      const resp = await fetch('/api/invites');
      const data = await resp.json();
      if (resp.ok) setInvites(data.invites || []);
    } catch (e) {
      // silent — the list is a convenience, not critical
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadInvites(); }, []);

  async function createInvite() {
    setCreating(true);
    setCopied(false);
    try {
      const resp = await fetch('/api/invites', { method: 'POST' });
      const data = await resp.json();
      if (resp.ok) {
        const link = `${window.location.origin}/signup?invite=${data.token}`;
        setNewLink(link);
        setInvites(data.invites || []);
      }
    } catch (e) {
      // leave newLink empty; person can retry
    } finally {
      setCreating(false);
    }
  }

  async function revokeInvite(token) {
    try {
      const resp = await fetch('/api/invites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await resp.json();
      if (resp.ok) setInvites(data.invites || []);
    } catch (e) {
      // no-op
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(newLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function inviteStatus(inv) {
    if (inv.used_at) return { label: `Used by ${inv.used_by_username || 'someone'}`, className: 'paid' };
    if (new Date(inv.expires_at) < new Date()) return { label: 'Expired', className: 'unpaid' };
    return { label: 'Active', className: 'pending' };
  }

  return (
    <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3>Invite someone</h3>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: -8, marginBottom: 16 }}>
          Generate a link that lets one person create their own private account. Each link works once and expires after 7 days.
        </p>

        <button className="primary" onClick={createInvite} disabled={creating} style={{ marginBottom: 12 }}>
          {creating ? 'Generating…' : '+ Generate invite link'}
        </button>

        {newLink && (
          <div className="ai-box" style={{ marginBottom: 16, wordBreak: 'break-all' }}>
            <span className="ai-label">New invite link — expires in 7 days, works once</span>
            {newLink}
            <div style={{ marginTop: 8 }}>
              <button type="button" className="ghost" onClick={copyLink} style={{ fontSize: 12 }}>
                {copied ? '✓ Copied' : 'Copy link'}
              </button>
            </div>
          </div>
        )}

        <div className="ai-label" style={{ marginBottom: 6 }}>Your invite links</div>
        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Loading…</p>
        ) : invites.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>None yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
            {invites.map((inv) => {
              const status = inviteStatus(inv);
              return (
                <div key={inv.token} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12.5 }}>
                  <div>
                    <span className={`status-pill ${status.className}`}>{status.label}</span>{' '}
                    <span style={{ color: 'var(--ink-soft)' }}>
                      created {fmtDateLong(inv.created_at.slice(0, 10))}
                    </span>
                  </div>
                  {!inv.used_at && (
                    <button className="icon-btn" title="Revoke this link" onClick={() => revokeInvite(inv.token)}>✕</button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function Tabs({ view, setView, dueCount = 0 }) {
  const tabs = [
    ['calendar', 'Calendar'],
    ['appointments', 'Appointments'],
    ['timeline', 'Timeline'],
    ['providers', 'Care Team'],
    ['reminders', 'Reminders'],
    ['finance', 'Finances'],
  ];
  return (
    <nav className="tabs">
      {tabs.map(([key, label]) => (
        <button key={key} className={view === key ? 'active' : ''} onClick={() => setView(key)} style={{ position: 'relative' }}>
          {label}
          {key === 'calendar' && dueCount > 0 && (
            <span
              title={`${dueCount} due today`}
              style={{
                position: 'absolute',
                top: 2,
                right: -6,
                background: 'var(--rose)',
                color: '#fff',
                borderRadius: '999px',
                fontSize: 10,
                fontWeight: 700,
                minWidth: 16,
                height: 16,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                lineHeight: 1,
              }}
            >
              {dueCount}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

// ==================== Calendar ====================

function CalendarView({ data, calCursor, setCalCursor, updateData, showToast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  const year = calCursor.getFullYear();
  const month = calCursor.getMonth();
  const label = calCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const todayStr = todayISO();

  const cells = [];
  for (let i = firstDow - 1; i >= 0; i--) cells.push({ day: daysInPrevMonth - i, inMonth: false, iso: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, inMonth: true, iso });
  }
  const remainder = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remainder; d++) cells.push({ day: d, inMonth: false, iso: null });

  const upcoming = [...data.appointments]
    .filter((a) => a.date >= todayStr)
    .sort((a, b) => ((a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1))
    .slice(0, 6);

  const { appts: todaysAppts, reminders: todaysReminders, total: todaysTotal } = getTodaysDueItems(data);

  return (
    <div className="view active">
      {todaysTotal > 0 && (
        <div className="panel" style={{ borderLeft: '4px solid var(--rose)', background: 'var(--rose-pale)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: todaysTotal > 0 ? 10 : 0 }}>
            <span style={{ fontSize: 18 }}>🔔</span>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--rose-deep)' }}>
              Today — {todaysTotal} {todaysTotal === 1 ? 'thing' : 'things'} to remember
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {todaysAppts.map((a) => (
              <div key={a.id} style={{ fontSize: 13.5 }}>
                <strong>Appointment:</strong> {a.what || 'Untitled'}{a.time ? ` at ${fmtTime(a.time)}` : ''}{a.providerName ? ` with ${a.providerName}` : ''}
              </div>
            ))}
            {todaysReminders.map((r) => (
              <div key={r.id} style={{ fontSize: 13.5 }}>
                <strong>Reminder:</strong> {r.what}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="panel">
        <div className="cal-header">
          <div className="month-label">{label}</div>
          <div className="cal-nav">
            <button className="ghost" onClick={() => setCalCursor((c) => { const d = new Date(c); d.setMonth(d.getMonth() - 1); return d; })}>‹</button>
            <button className="ghost" onClick={() => { const d = new Date(); d.setDate(1); setCalCursor(d); }}>Today</button>
            <button className="ghost" onClick={() => setCalCursor((c) => { const d = new Date(c); d.setMonth(d.getMonth() + 1); return d; })}>›</button>
          </div>
        </div>
        <div className="cal-grid">
          {['S','M','T','W','T','F','S'].map((d, i) => <div key={i} className="cal-dow">{d}</div>)}
          {cells.map((c, i) => {
            const hasAppt = c.iso && data.appointments.some((a) => a.date === c.iso);
            const hasReminder = c.iso && data.reminders.some((r) => reminderOccursOn(r, c.iso));
            const hasSymptom = c.iso && data.timeline.some((s) => s.date === c.iso);
            const hasAnything = hasAppt || hasReminder || hasSymptom;
            return (
              <button
                key={i}
                type="button"
                onClick={() => c.iso && setSelectedDay(c.iso)}
                disabled={!c.iso}
                className={`cal-cell ${c.inMonth ? 'in-month' : 'out-month'} ${c.iso === todayStr ? 'today' : ''}`}
                style={{
                  cursor: c.iso ? 'pointer' : 'default',
                  border: hasAnything ? undefined : (c.iso === todayStr ? undefined : '1px solid transparent'),
                  font: 'inherit',
                  color: 'inherit',
                  background: c.iso === todayStr ? undefined : 'transparent',
                }}
              >
                <div>{c.day}</div>
                {hasAnything && (
                  <div className="dot-row">
                    {hasAppt && <div className="dot" />}
                    {hasReminder && <div className="dot reminder" />}
                    {hasSymptom && <div className="dot symptom" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {selectedDay && (
        <DayDetailModal
          iso={selectedDay}
          data={data}
          onClose={() => setSelectedDay(null)}
        />
      )}
      <div className="panel">
        <div className="panel-head"><h2>Upcoming</h2></div>
        {upcoming.length === 0 ? (
          <div className="empty-state"><div className="big">Nothing scheduled</div>Add your next appointment to get started.</div>
        ) : (
          upcoming.map((a) => <ApptRow key={a.id} a={a} showActions={false} />)
        )}
      </div>
    </div>
  );
}

// Shows everything tied to one specific date — past or future — so the
// calendar works as a real history, not just an upcoming-only view.
function DayDetailModal({ iso, data, onClose }) {
  const dayAppts = data.appointments.filter((a) => a.date === iso);
  const dayReminders = data.reminders.filter((r) => reminderOccursOn(r, iso));
  const daySymptoms = data.timeline.filter((s) => s.date === iso);
  const isPast = iso < todayISO();
  const isToday = iso === todayISO();
  const totalCount = dayAppts.length + dayReminders.length + daySymptoms.length;

  return (
    <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3>
          {fmtDateLong(iso)}
          {isToday && <span className="badge" style={{ marginLeft: 8 }}>Today</span>}
          {isPast && !isToday && <span className="badge past" style={{ marginLeft: 8 }}>Past</span>}
        </h3>

        {totalCount === 0 ? (
          <div className="empty-state">
            <div className="big">Nothing recorded</div>
            No appointments, reminders, or timeline entries for this day.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {dayAppts.length > 0 && (
              <div>
                <div className="ai-label" style={{ marginBottom: 6 }}>Appointments</div>
                {dayAppts.map((a) => <ApptRow key={a.id} a={a} showActions={false} />)}
              </div>
            )}

            {dayReminders.length > 0 && (
              <div>
                <div className="ai-label" style={{ marginBottom: 6 }}>Reminders due</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dayReminders.map((r) => (
                    <div key={r.id} className="item-row">
                      <div className="item-body">
                        <div className="item-title">{r.what}<span className="badge recurring">{r.freq}</span></div>
                        {r.notes && <div className="item-notes">{r.notes}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {daySymptoms.length > 0 && (
              <div>
                <div className="ai-label" style={{ marginBottom: 6 }}>Timeline entries</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {daySymptoms.map((s) => (
                    <div key={s.id} className="item-row">
                      <div className="item-body">
                        <div className="item-title">{s.what}<span className={`badge severity-${s.severity}`}>{s.severity}</span></div>
                        {s.notes && <div className="item-notes">{s.notes}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ==================== Appointments ====================

function ApptRow({ a, showActions, onEdit, onDelete }) {
  const badge = fmtDateBadge(a.date);
  const isPast = a.date < todayISO();

  function handleAddToCalendar() {
    const ics = buildApptIcs(a);
    downloadIcsFile(`${slugForFilename(a.what)}.ics`, ics);
  }

  return (
    <div className="item-row">
      <div className="item-date-badge"><div className="mon">{badge.mon}</div><div className="day">{badge.day}</div></div>
      <div className="item-body">
        <div className="title-row">
          <div className="item-title">{a.what || 'Untitled appointment'}{isPast && <span className="badge past">Past</span>}</div>
        </div>
        <div className="item-meta">{[a.providerName, a.time ? fmtTime(a.time) : '', a.location].filter(Boolean).join(' · ')}</div>
        {!isPast && (
          <button
            className="ghost"
            onClick={handleAddToCalendar}
            style={{ fontSize: 11.5, padding: '4px 10px', marginTop: 6 }}
            title="Download a calendar file to add this to your phone's calendar app, with a 1-hour-before reminder"
          >
            📅 Add to Calendar
          </button>
        )}
        {a.notes && <div className="item-notes">{a.notes}</div>}
        {a.docs && a.docs.length > 0 && (
          <div className="item-docs">
            {a.docs.map((d, i) => (
              <div key={i}>
                <span className="doc-chip"><span className="doc-type">{d.type}</span>{d.name}</span>
                {d.explanation && (
                  <div className="ai-box" style={{ marginTop: 4 }}>
                    <span className="ai-label">Plain-language explanation</span>
                    {d.explanation}
                    <span className="ai-disclaimer">General information only, not medical advice.</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {a.feeling && <div className="item-notes"><strong style={{ fontWeight: 600 }}>How it went:</strong> {a.feeling}</div>}
        {a.feelingReflection && (
          <div className="ai-box" style={{ marginTop: 6 }}>
            <span className="ai-label">Reflection</span>{a.feelingReflection}
          </div>
        )}
      </div>
      {showActions && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button className="icon-btn" title="Edit" onClick={() => onEdit(a)}>✎</button>
          <button className="icon-btn" title="Delete" onClick={() => onDelete(a.id)}>✕</button>
        </div>
      )}
    </div>
  );
}

function AppointmentsView({ data, updateData, showToast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const sorted = [...data.appointments].sort((a, b) => ((a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1));

  function openNew() { setEditing(null); setModalOpen(true); }
  function openEdit(a) { setEditing(a); setModalOpen(true); }

  function handleSave(apptData) {
    updateData((d) => {
      if (editing) {
        const idx = d.appointments.findIndex((a) => a.id === editing.id);
        if (idx > -1) d.appointments[idx] = { ...d.appointments[idx], ...apptData };
      } else {
        d.appointments.push({ id: uid(), ...apptData });
      }
      return d;
    });
    setModalOpen(false);
    showToast('Appointment saved');
  }

  function handleDelete(id) {
    updateData((d) => { d.appointments = d.appointments.filter((a) => a.id !== id); return d; });
    showToast('Appointment removed');
  }

  return (
    <div className="view active">
      <div className="panel">
        <div className="panel-head">
          <h2>All appointments</h2>
          <button className="primary" onClick={openNew}>+ New appointment</button>
        </div>
        {sorted.length === 0 ? (
          <div className="empty-state"><div className="big">No appointments yet</div>Log your checkups and provider visits here.</div>
        ) : (
          sorted.map((a) => <ApptRow key={a.id} a={a} showActions onEdit={openEdit} onDelete={handleDelete} />)
        )}
      </div>
      {modalOpen && (
        <ApptModal
          existing={editing}
          providers={data.providers}
          onCancel={() => setModalOpen(false)}
          onSave={handleSave}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function ApptModal({ existing, providers, onCancel, onSave, showToast }) {
  const [what, setWhat] = useState(existing?.what || '');
  const [providerId, setProviderId] = useState(existing?.providerId || '');
  const [date, setDate] = useState(existing?.date || todayISO());
  const [time, setTime] = useState(existing?.time || '');
  const [location, setLocation] = useState(existing?.location || '');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [docs, setDocs] = useState(existing?.docs ? structuredClone(existing.docs) : []);
  const [docType, setDocType] = useState('Result');
  const [docName, setDocName] = useState('');
  const [docText, setDocText] = useState('');
  const [feeling, setFeeling] = useState(existing?.feeling || '');
  const [feelingReflection, setFeelingReflection] = useState(existing?.feelingReflection || '');
  const [reflecting, setReflecting] = useState(false);
  const [explainingIdx, setExplainingIdx] = useState(null);

  function addDoc() {
    if (!docName.trim()) return;
    setDocs((prev) => [...prev, { type: docType, name: docName.trim(), text: docText.trim() }]);
    setDocName('');
    setDocText('');
  }

  function removeDoc(i) {
    setDocs((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function explainDoc(i) {
    const doc = docs[i];
    if (!doc?.text) return;
    setExplainingIdx(i);
    try {
      const resp = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: doc.text, docType: doc.type }),
      });
      const json = await resp.json();
      if (!resp.ok) { showToast(json.error || 'Failed to explain'); return; }
      setDocs((prev) => prev.map((d, idx) => (idx === i ? { ...d, explanation: json.explanation } : d)));
    } catch (e) {
      showToast('Something went wrong');
    } finally {
      setExplainingIdx(null);
    }
  }

  async function reflectOnFeeling() {
    if (!feeling.trim()) return;
    setReflecting(true);
    try {
      const resp = await fetch('/api/ai/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: feeling }),
      });
      const json = await resp.json();
      if (!resp.ok) { showToast(json.error || 'Failed to reflect'); return; }
      setFeelingReflection(json.reflection);
    } catch (e) {
      showToast('Something went wrong');
    } finally {
      setReflecting(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!what.trim()) return;
    const provider = providers.find((p) => p.id === providerId);
    onSave({
      what: what.trim(),
      providerId: providerId || null,
      providerName: provider ? provider.name : '',
      date: date || todayISO(),
      time,
      location: location.trim(),
      notes: notes.trim(),
      docs,
      feeling: feeling.trim(),
      feelingReflection,
    });
  }

  return (
    <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal">
        <h3>{existing ? 'Edit appointment' : 'New appointment'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field full">
              <label>What's it for</label>
              <input value={what} onChange={(e) => setWhat(e.target.value)} placeholder="e.g. Annual physical, Follow-up scan" autoFocus />
            </div>
            <div className="field full">
              <label>Provider</label>
              <select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
                <option value="">— Select from care team (optional) —</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.specialty ? ' · ' + p.specialty : ''}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="field full">
              <label>Location</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional — clinic address or telehealth link" />
            </div>
            <div className="field full">
              <label>Notes — prep, questions to ask, follow-ups</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Fast for 8 hours before. Ask about medication dosage." />
            </div>
            <div className="field full">
              <label>Documents from this visit</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <select value={docType} onChange={(e) => setDocType(e.target.value)} style={{ flex: '0 0 140px' }}>
                  <option value="Result">Result</option>
                  <option value="Referral">Referral</option>
                  <option value="Instructions">Instructions</option>
                  <option value="Other">Other</option>
                </select>
                <input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="e.g. Bloodwork panel, MRI report" />
              </div>
              <textarea
                value={docText}
                onChange={(e) => setDocText(e.target.value)}
                placeholder="Optional — paste or type what the result says, and Bloom Trail can explain it in plain language"
                style={{ marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button type="button" className="ghost" onClick={addDoc}>Add document</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {docs.map((d, i) => (
                  <div key={i} className="doc-chip-wrap">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span className="doc-chip"><span className="doc-type">{d.type}</span>{d.name}</span>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {d.text && d.text.trim() && (
                          <button
                            type="button"
                            className="ghost ai-btn"
                            style={{ fontSize: 11, padding: '4px 10px' }}
                            disabled={explainingIdx === i}
                            onClick={() => explainDoc(i)}
                          >
                            {explainingIdx === i ? 'Thinking…' : d.explanation ? '↻ Re-explain' : '✨ Explain'}
                          </button>
                        )}
                        <button type="button" className="icon-btn" style={{ fontSize: 12 }} onClick={() => removeDoc(i)}>✕</button>
                      </div>
                    </div>
                    {d.explanation && (
                      <div className="ai-box" style={{ marginTop: 8 }}>
                        <span className="ai-label">Plain-language explanation</span>
                        {d.explanation}
                        <span className="ai-disclaimer">General information only, not medical advice.</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="field full">
              <label>How did it go? <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>(optional, after the visit)</span></label>
              <textarea value={feeling} onChange={(e) => setFeeling(e.target.value)} placeholder="Jot down how you felt during or after the visit" />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <button type="button" className="ghost ai-btn" onClick={reflectOnFeeling} disabled={reflecting}>
                  {reflecting ? 'Thinking…' : '✨ Reflect on this'}
                </button>
              </div>
              {feelingReflection && (
                <div className="ai-box" style={{ marginTop: 8 }}>
                  <span className="ai-label">Reflection</span>{feelingReflection}
                </div>
              )}
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
            <button type="submit" className="primary">Save appointment</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== Timeline ====================

function TimelineView({ data, updateData, showToast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const sorted = [...data.timeline].sort((a, b) => (a.date < b.date ? 1 : -1));

  function handleSave(entry) {
    updateData((d) => { d.timeline.push({ id: uid(), ...entry }); return d; });
    setModalOpen(false);
    showToast('Timeline entry saved');
  }

  function handleDelete(id) {
    updateData((d) => { d.timeline = d.timeline.filter((s) => s.id !== id); return d; });
    showToast('Entry removed');
  }

  return (
    <div className="view active">
      <div className="panel">
        <div className="panel-head">
          <h2>Symptom &amp; condition timeline</h2>
          <button className="primary" onClick={() => setModalOpen(true)}>+ Log entry</button>
        </div>
        <div className="section-note">A running record of how you're feeling, separate from scheduled visits.</div>
        {sorted.length === 0 ? (
          <div className="empty-state"><div className="big">Nothing logged yet</div>Track symptoms, flare-ups, or how you&apos;re responding to treatment over time.</div>
        ) : (
          <div className="timeline">
            {sorted.map((s) => (
              <div key={s.id} className="timeline-entry">
                <div className="timeline-date">{fmtDateLong(s.date)}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div className="timeline-title">{s.what}<span className={`badge severity-${s.severity}`}>{s.severity}</span></div>
                  <button className="icon-btn" onClick={() => handleDelete(s.id)}>✕</button>
                </div>
                {s.notes && <div className="timeline-note">{s.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
      {modalOpen && <SymptomModal onCancel={() => setModalOpen(false)} onSave={handleSave} />}
    </div>
  );
}

function SymptomModal({ onCancel, onSave }) {
  const [what, setWhat] = useState('');
  const [date, setDate] = useState(todayISO());
  const [severity, setSeverity] = useState('mild');
  const [notes, setNotes] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!what.trim()) return;
    onSave({ what: what.trim(), date: date || todayISO(), severity, notes: notes.trim() });
  }

  return (
    <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal">
        <h3>Log a timeline entry</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field full">
              <label>What's going on</label>
              <input value={what} onChange={(e) => setWhat(e.target.value)} placeholder="e.g. Migraine, New rash, Feeling better on new dose" autoFocus />
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Severity</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
              </select>
            </div>
            <div className="field full">
              <label>Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Details, triggers, what helped" />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
            <button type="submit" className="primary">Save entry</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== Providers ====================

function ProvidersView({ data, updateData, showToast }) {
  const [modalOpen, setModalOpen] = useState(false);

  function handleSave(p) {
    updateData((d) => { d.providers.push({ id: uid(), ...p }); return d; });
    setModalOpen(false);
    showToast('Provider added');
  }

  function handleDelete(id) {
    updateData((d) => {
      d.providers = d.providers.filter((p) => p.id !== id);
      d.appointments.forEach((a) => { if (a.providerId === id) a.providerId = null; });
      return d;
    });
    showToast('Provider removed');
  }

  return (
    <div className="view active">
      <div className="panel">
        <div className="panel-head">
          <h2>Care team</h2>
          <button className="primary" onClick={() => setModalOpen(true)}>+ Add provider</button>
        </div>
        <div className="section-note">Keep your providers here once, then pick them when booking an appointment.</div>
        {data.providers.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}><div className="big">Your care team is empty</div>Add the doctors and specialists you see.</div>
        ) : (
          <div className="provider-grid">
            {data.providers.map((p) => (
              <div key={p.id} className="provider-card">
                <div className="avatar-ring">{initials(p.name)}</div>
                <div className="p-name">{p.name}</div>
                {p.specialty && <div className="p-specialty">{p.specialty}</div>}
                <div className="p-meta">{[p.clinic, p.phone].filter(Boolean).map((line, i) => <span key={i}>{line}<br /></span>)}</div>
                {p.notes && <div className="item-notes" style={{ marginTop: 8 }}>{p.notes}</div>}
                <button className="icon-btn p-actions" onClick={() => handleDelete(p.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
      {modalOpen && <ProviderModal onCancel={() => setModalOpen(false)} onSave={handleSave} />}
    </div>
  );
}

function ProviderModal({ onCancel, onSave }) {
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [phone, setPhone] = useState('');
  const [clinic, setClinic] = useState('');
  const [notes, setNotes] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), specialty: specialty.trim(), phone: phone.trim(), clinic: clinic.trim(), notes: notes.trim() });
  }

  return (
    <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal">
        <h3>Add a provider</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field full">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dr. Amara Chen" autoFocus />
            </div>
            <div className="field">
              <label>Specialty</label>
              <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Cardiology" />
            </div>
            <div className="field">
              <label>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
            </div>
            <div className="field full">
              <label>Clinic / practice</label>
              <input value={clinic} onChange={(e) => setClinic(e.target.value)} placeholder="Optional" />
            </div>
            <div className="field full">
              <label>Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Portal login hints, best way to reach them, etc." />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
            <button type="submit" className="primary">Save provider</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== Reminders ====================

function RemindersView({ data, updateData, showToast }) {
  const [modalOpen, setModalOpen] = useState(false);

  function handleSave(r) {
    updateData((d) => { d.reminders.push({ id: uid(), ...r }); return d; });
    setModalOpen(false);
    showToast('Reminder saved');
  }

  function handleDelete(id) {
    updateData((d) => { d.reminders = d.reminders.filter((r) => r.id !== id); return d; });
    showToast('Reminder removed');
  }

  return (
    <div className="view active">
      <div className="panel">
        <div className="panel-head">
          <h2>Recurring reminders</h2>
          <button className="primary" onClick={() => setModalOpen(true)}>+ New reminder</button>
        </div>
        <div className="section-note">Meds, refills, and anything that repeats on a schedule.</div>
        {data.reminders.length === 0 ? (
          <div className="empty-state"><div className="big">No reminders yet</div>Add meds, refills, or anything recurring.</div>
        ) : (
          data.reminders.map((r) => {
            const freqLabel = r.freq.charAt(0).toUpperCase() + r.freq.slice(1);
            const b = fmtDateBadge(r.start);
            return (
              <div key={r.id} className="item-row">
                <div className="item-date-badge" style={{ background: 'var(--peach-soft)' }}>
                  <div className="mon" style={{ color: 'var(--gold)' }}>{freqLabel}</div>
                  <div className="day" style={{ fontSize: 12 }}>since {b.mon} {b.day}</div>
                </div>
                <div className="item-body">
                  <div className="title-row">
                    <div className="item-title">{r.what}<span className="badge recurring">{freqLabel}</span></div>
                  </div>
                  {r.notes && <div className="item-notes">{r.notes}</div>}
                  <button
                    className="ghost"
                    onClick={() => downloadIcsFile(`${slugForFilename(r.what)}.ics`, buildReminderIcs(r))}
                    style={{ fontSize: 11.5, padding: '4px 10px', marginTop: 6 }}
                    title="Download a calendar file to add this recurring reminder to your phone's calendar app"
                  >
                    📅 Add to Calendar
                  </button>
                </div>
                <button className="icon-btn" onClick={() => handleDelete(r.id)}>✕</button>
              </div>
            );
          })
        )}
      </div>
      {modalOpen && <ReminderModal onCancel={() => setModalOpen(false)} onSave={handleSave} />}
    </div>
  );
}

function ReminderModal({ onCancel, onSave }) {
  const [what, setWhat] = useState('');
  const [freq, setFreq] = useState('daily');
  const [start, setStart] = useState(todayISO());
  const [notes, setNotes] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!what.trim()) return;
    onSave({ what: what.trim(), freq, start: start || todayISO(), notes: notes.trim() });
  }

  return (
    <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal">
        <h3>New recurring reminder</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field full">
              <label>Reminder</label>
              <input value={what} onChange={(e) => setWhat(e.target.value)} placeholder="e.g. Take blood pressure medication" autoFocus />
            </div>
            <div className="field">
              <label>Frequency</label>
              <select value={freq} onChange={(e) => setFreq(e.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="field">
              <label>Starting</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="field full">
              <label>Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Dosage, refill pharmacy, etc." />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
            <button type="submit" className="primary">Save reminder</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== Finance ====================

function FinanceView({ data, updateData, showToast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const currency = data.currency || '$';

  const total = data.finance.reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const owe = data.finance.filter((f) => f.status !== 'paid').reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const paid = data.finance.filter((f) => f.status === 'paid').reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const sorted = [...data.finance].sort((a, b) => (a.date < b.date ? 1 : -1));

  function handleCurrencyChange(e) {
    updateData((d) => { d.currency = e.target.value; return d; });
    showToast('Currency updated');
  }

  function handleSave(entry) {
    updateData((d) => { d.finance.push({ id: uid(), ...entry }); return d; });
    setModalOpen(false);
    showToast('Billing entry saved');
  }

  function handleDelete(id) {
    updateData((d) => { d.finance = d.finance.filter((f) => f.id !== id); return d; });
    showToast('Entry removed');
  }

  return (
    <div className="view active">
      <div className="panel-head" style={{ marginBottom: 14 }}>
        <div></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ margin: 0 }}>Currency</label>
          <select value={currency} onChange={handleCurrencyChange} style={{ width: 'auto', padding: '6px 10px' }}>
            {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>
      <div className="stat-row">
        <div className="stat-box"><div className="stat-label">Total billed</div><div className="stat-value">{fmtMoney(total, currency)}</div></div>
        <div className="stat-box owe"><div className="stat-label">Outstanding</div><div className="stat-value">{fmtMoney(owe, currency)}</div></div>
        <div className="stat-box paid"><div className="stat-label">Paid</div><div className="stat-value">{fmtMoney(paid, currency)}</div></div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>Billing &amp; expenses</h2>
          <button className="primary" onClick={() => setModalOpen(true)}>+ Add entry</button>
        </div>
        {sorted.length === 0 ? (
          <div className="empty-state"><div className="big">No billing entries yet</div>Add a bill, EOB, or payment to start tracking costs.</div>
        ) : (
          <div className="overflow-x">
            <table className="fin-table">
              <thead>
                <tr><th>Date</th><th>Description</th><th>Provider</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th><th></th></tr>
              </thead>
              <tbody>
                {sorted.map((f) => (
                  <tr key={f.id}>
                    <td>{f.date ? fmtDateLong(f.date) : '—'}</td>
                    <td>{f.desc}</td>
                    <td>{f.provider || '—'}</td>
                    <td><span className={`status-pill ${f.status}`}>{f.status.charAt(0).toUpperCase() + f.status.slice(1)}</span></td>
                    <td className="amount">{fmtMoney(f.amount, currency)}</td>
                    <td><button className="icon-btn" onClick={() => handleDelete(f.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {modalOpen && <FinModal onCancel={() => setModalOpen(false)} onSave={handleSave} />}
    </div>
  );
}

function FinModal({ onCancel, onSave }) {
  const [desc, setDesc] = useState('');
  const [provider, setProvider] = useState('');
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('unpaid');

  function handleSubmit(e) {
    e.preventDefault();
    if (!desc.trim()) return;
    onSave({ desc: desc.trim(), provider: provider.trim(), date: date || todayISO(), amount: parseFloat(amount) || 0, status });
  }

  return (
    <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal">
        <h3>New billing entry</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field full">
              <label>Description</label>
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Lab work, MRI, copay" autoFocus />
            </div>
            <div className="field">
              <label>Provider</label>
              <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Optional" />
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Amount</label>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="field">
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="unpaid">Unpaid</option>
                <option value="pending">Pending / in review</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
            <button type="submit" className="primary">Save entry</button>
          </div>
        </form>
      </div>
    </div>
  );
}
