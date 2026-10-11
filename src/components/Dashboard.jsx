import { useMemo } from 'react';
import { useData } from '../store.jsx';
import { formatDateTime } from '../utils.js';

function StatCard({ icon, label, value, hint, tone }) {
  return (
    <div className="col-6 col-xl-3">
      <div className={`stat-card tone-${tone}`}>
        <div className="stat-icon"><i className={`bi ${icon}`} /></div>
        <div>
          <div className="stat-value">{value}</div>
          <div className="stat-label">{label}</div>
          {hint && <div className="stat-hint">{hint}</div>}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ go, setSession }) {
  const { data } = useData();

  const s = useMemo(() => {
    const roleOf = new Map(data.members.map((m) => [m.memberId, m.role]));
    const nameOf = new Map(data.members.map((m) => [m.memberId, m.name]));
    const participants = data.members.filter((m) => m.role === 'Participant').length;
    const bearers = data.members.length - participants;
    const perSession = data.sessions.map((ss) => {
      const recs = data.attendance.filter((a) => a.session === ss.id);
      const p = recs.filter((a) => roleOf.get(a.memberId) === 'Participant').length;
      const o = recs.filter((a) => roleOf.get(a.memberId) === 'Office Bearer').length;
      return { ...ss, p, o, total: p + o, pct: data.members.length ? Math.round(((p + o) / data.members.length) * 100) : 0 };
    });
    const active = perSession.filter((x) => x.total > 0).length;
    const avg = active ? Math.round(perSession.reduce((t, x) => t + x.total, 0) / active) : 0;
    const best = perSession.reduce((b, x) => (x.total > b.total ? x : b), perSession[0]);
    const recent = [...data.attendance]
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
      .slice(0, 8)
      .map((a) => ({ ...a, name: nameOf.get(a.memberId) || a.memberId, role: roleOf.get(a.memberId) }));
    return { participants, bearers, perSession, active, avg, best, recent };
  }, [data]);

  return (
    <>
      <div className="hero-band">
        <div>
          <h1>CALIBRIX 2K26</h1>
          <p>Digital attendance across {data.sessions.length} sessions. Add members, print QR codes, scan at the door.</p>
        </div>
        <div className="hero-actions">
          <button className="btn btn-teal" onClick={() => go('attendance')}><i className="bi bi-qr-code-scan me-2" />Take attendance</button>
          <button className="btn btn-outline-light" onClick={() => go('members')}><i className="bi bi-person-plus me-2" />Add members</button>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <StatCard icon="bi-people-fill" label="Total participants" value={s.participants} tone="navy" />
        <StatCard icon="bi-award-fill" label="Office bearers" value={s.bearers} tone="teal" />
        <StatCard icon="bi-check2-circle" label="Attendance marked" value={data.attendance.length} hint="All sessions combined" tone="navy" />
        <StatCard icon="bi-bar-chart-fill" label="Average per session" value={s.avg} hint={s.active ? `${s.active} of 12 sessions started` : 'No sessions started'} tone="teal" />
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="panel">
            <div className="panel-head">
              <h2>Session-wise attendance</h2>
              <span className="text-muted small">Out of {data.members.length} members</span>
            </div>
            <div className="table-responsive">
              <table className="table align-middle session-table mb-0">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th className="text-end">Participants</th>
                    <th className="text-end">Office bearers</th>
                    <th className="text-end">Total</th>
                    <th style={{ minWidth: 150 }}>Turnout</th>
                  </tr>
                </thead>
                <tbody>
                  {s.perSession.map((x) => (
                    <tr key={x.id} className="clickable" onClick={() => { setSession(x.id); go('attendance'); }} title="Open this session">
                      <td className="fw-semibold">{x.name}</td>
                      <td className="text-end">{x.p}</td>
                      <td className="text-end">{x.o}</td>
                      <td className="text-end fw-bold">{x.total}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="progress flex-grow-1" style={{ height: 8 }}>
                            <div className="progress-bar" style={{ width: `${x.pct}%` }} />
                          </div>
                          <span className="small text-muted" style={{ width: 36 }}>{x.pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="panel h-100">
            <div className="panel-head"><h2>Recent check-ins</h2></div>
            {s.recent.length === 0 ? (
              <div className="empty-state small">
                <i className="bi bi-clock-history" />
                <p>No attendance yet. Check-ins will appear here as they happen.</p>
              </div>
            ) : (
              <ul className="list-unstyled recent-list mb-0">
                {s.recent.map((r) => (
                  <li key={`${r.memberId}-${r.session}`}>
                    <div className="avatar">{r.name.charAt(0).toUpperCase()}</div>
                    <div className="flex-grow-1 min-w-0">
                      <div className="fw-semibold text-truncate">{r.name}</div>
                      <div className="small text-muted">Session {r.session} · {formatDateTime(r.timestamp)}</div>
                    </div>
                    <span className={`badge ${r.role === 'Office Bearer' ? 'badge-teal' : 'badge-navy'}`}>{r.role === 'Office Bearer' ? 'OB' : 'P'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
