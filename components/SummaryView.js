'use client';

import { useMemo, useState } from 'react';
import { computeSummary, periodRange, shiftAnchor, summaryToText, toISO } from '@/lib/summary';

function money(n, currency) {
  return (currency || '$') + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDay(iso, opts) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, opts || { month: 'short', day: 'numeric' });
}

function rangeLabel(kind, start, end) {
  if (kind === 'month') return fmtDay(start, { month: 'long', year: 'numeric' });
  return `${fmtDay(start)} – ${fmtDay(end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function Bar({ value, max, color }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div aria-hidden style={{ height: 8, borderRadius: 999, background: 'var(--line)', overflow: 'hidden', flex: 1, minWidth: 60 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color || 'var(--rose)', borderRadius: 999 }} />
    </div>
  );
}

export default function SummaryView({ data }) {
  const todayStr = toISO(new Date());
  const [kind, setKind] = useState('week');
  const [anchor, setAnchor] = useState(todayStr);
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState('');

  const { start, end } = periodRange(kind, anchor);
  const s = useMemo(() => computeSummary(data, start, end, todayStr), [data, start, end, todayStr]);
  const label = rangeLabel(kind, start, end);
  const isCurrent = todayStr >= start && todayStr <= end;
  const currency = data.currency || '$';
  const isEmpty = s.dueTotal === 0 && s.symptomEntries === 0 && s.attended.length === 0 && s.upcoming.length === 0 && s.finance.count === 0;

  function go(dir) { setAnchor(shiftAnchor(kind, anchor, dir)); setAiText(''); setAiErr(''); }
  function setPeriod(k) { setKind(k); setAnchor(todayStr); setAiText(''); setAiErr(''); }

  async function writeSummary() {
    setAiBusy(true); setAiErr(''); setAiText('');
    try {
      const resp = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: summaryToText(s, label) }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) { setAiErr(json.error || 'Could not write a summary.'); return; }
      setAiText(json.summary);
    } catch { setAiErr('Something went wrong. Please try again.'); }
    finally { setAiBusy(false); }
  }

  const maxSymptom = Math.max(1, ...s.symptoms.map((y) => y.count));

  return (
    <div className="view active">
      <div className="panel">
        <div className="panel-head">
          <h2>Summary</h2>
          <div style={{ display: 'flex', gap: 6 }} role="group" aria-label="Period">
            <button className={kind === 'week' ? 'primary' : 'ghost'} onClick={() => setPeriod('week')}>Week</button>
            <button className={kind === 'month' ? 'primary' : 'ghost'} onClick={() => setPeriod('month')}>Month</button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button className="ghost" onClick={() => go(-1)} aria-label={`Previous ${kind}`}>‹</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 600 }}>{label}</div>
            {isCurrent && <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{kind === 'week' ? 'This week' : 'This month'} so far</div>}
          </div>
          <button className="ghost" onClick={() => go(1)} disabled={end >= todayStr} aria-label={`Next ${kind}`}>›</button>
        </div>
      </div>

      {isEmpty ? (
        <div className="panel">
          <div className="empty-state"><div className="big">Nothing recorded for this {kind}</div>Appointments, symptoms, reminders you tick off, and bills will be summarized here.</div>
        </div>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat-box paid">
              <div className="stat-label">Reminders done</div>
              <div className="stat-value">{s.dueTotal > 0 ? `${s.doneTotal}/${s.dueTotal}` : '—'}</div>
              {s.adherence !== null && <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{s.adherence}% completed</div>}
            </div>
            <div className="stat-box">
              <div className="stat-label">Symptom entries</div>
              <div className="stat-value">{s.symptomEntries}</div>
              {s.severeDays > 0 && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{s.severeDays} severe {s.severeDays === 1 ? 'day' : 'days'}</div>}
            </div>
            <div className="stat-box">
              <div className="stat-label">Check-ups attended</div>
              <div className="stat-value">{s.attended.length}</div>
              {s.upcoming.length > 0 && <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{s.upcoming.length} coming up</div>}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h2>Medicines &amp; reminders</h2></div>
            {s.reminders.length === 0 ? (
              <div className="section-note">No recurring reminders were due in this period.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {s.reminders.map((r) => (
                  <div key={r.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14 }}>
                      <span style={{ fontWeight: 600 }}>{r.what}</span>
                      <span style={{ color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{r.done} of {r.due} {r.due === 1 ? 'time' : 'times'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <div aria-hidden style={{ height: 8, borderRadius: 999, background: 'var(--line)', overflow: 'hidden', flex: 1 }}>
                        <div style={{ width: `${Math.round((r.done / r.due) * 100)}%`, height: '100%', background: 'var(--rose)', borderRadius: 999 }} />
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--ink-soft)', width: 36, textAlign: 'right' }}>{Math.round((r.done / r.due) * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="section-note" style={{ marginTop: 10 }}>Counts a reminder as taken when you tick it done. Days that haven’t happened yet aren’t counted.</div>
          </div>

          <div className="panel">
            <div className="panel-head"><h2>Common symptoms</h2></div>
            {s.symptoms.length === 0 ? (
              <div className="section-note">No symptoms were logged in this period.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {s.symptoms.map((y) => (
                  <div key={y.name} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                    <span style={{ width: '34%', minWidth: 90, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{y.name}</span>
                    <Bar value={y.count} max={maxSymptom} />
                    <span style={{ width: 28, textAlign: 'right' }}>{y.count}×</span>
                    <span className={`badge severity-${y.worst}`}>{y.worst}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="section-note" style={{ marginTop: 10 }}>The badge shows the worst severity logged for that symptom.</div>
          </div>

          <div className="panel">
            <div className="panel-head"><h2>Appointments &amp; check-ups</h2></div>
            {s.attended.length === 0 && s.upcoming.length === 0 ? (
              <div className="section-note">No appointments in this period.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {s.attended.map((a) => (
                  <div key={a.id} className="item-row">
                    <div className="item-body">
                      <div className="item-title">{a.what || 'Appointment'} <span className="badge past">attended</span></div>
                      <div className="item-notes">{fmtDay(a.date, { weekday: 'short', month: 'short', day: 'numeric' })}{a.providerName ? ` · ${a.providerName}` : ''}</div>
                    </div>
                  </div>
                ))}
                {s.upcoming.map((a) => (
                  <div key={a.id} className="item-row">
                    <div className="item-body">
                      <div className="item-title">{a.what || 'Appointment'} <span className="badge recurring">upcoming</span></div>
                      <div className="item-notes">{fmtDay(a.date, { weekday: 'short', month: 'short', day: 'numeric' })}{a.providerName ? ` · ${a.providerName}` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {s.providers.length > 1 && (
              <div className="section-note" style={{ marginTop: 10 }}>
                By provider: {s.providers.map((p) => `${p.name} (${p.count})`).join(', ')}
              </div>
            )}
          </div>

          {s.finance.count > 0 && (
            <div className="panel">
              <div className="panel-head"><h2>Costs</h2></div>
              <div className="stat-row" style={{ marginBottom: 0 }}>
                <div className="stat-box"><div className="stat-label">Billed</div><div className="stat-value">{money(s.finance.billed, currency)}</div></div>
                <div className="stat-box paid"><div className="stat-label">Paid</div><div className="stat-value">{money(s.finance.paid, currency)}</div></div>
                <div className="stat-box owe"><div className="stat-label">Outstanding</div><div className="stat-value">{money(s.finance.outstanding, currency)}</div></div>
              </div>
            </div>
          )}

          <div className="panel">
            <div className="panel-head">
              <h2>✨ Written recap</h2>
              <button className="ghost ai-btn" onClick={writeSummary} disabled={aiBusy}>{aiBusy ? 'Thinking…' : aiText ? '↻ Rewrite' : '✨ Write a recap'}</button>
            </div>
            {aiErr && <div role="alert" style={{ color: 'var(--danger)', fontSize: 13 }}>{aiErr}</div>}
            {aiText ? (
              <div className="ai-box"><span className="ai-label">Recap</span>{aiText}
                <span className="ai-disclaimer" style={{ display: 'block', marginTop: 6 }}>General information only, not medical advice.</span>
              </div>
            ) : (
              !aiErr && <div className="section-note">Optional: have AI turn these numbers into a few plain sentences. Only the counts and names above are sent, not your notes.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
