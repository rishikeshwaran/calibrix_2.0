import { useMemo, useState } from 'react';
import { useData } from '../store.jsx';
import { ROLES, SESSION_COUNT, downloadCSV, downloadXLSX, formatDateTime, stamp } from '../utils.js';

const PAGE_SIZE = 25;
const sessionIds = Array.from({ length: SESSION_COUNT }, (_, i) => i + 1);

export default function Reports({ session, setSession }) {
  const { data, notify } = useData();
  const [view, setView] = useState('overall'); // overall | session
  const [q, setQ] = useState('');
  const [roleF, setRoleF] = useState('All');
  const [statusF, setStatusF] = useState('All');
  const [page, setPage] = useState(1);

  const lookup = useMemo(() => {
    const m = new Map();
    data.attendance.forEach((a) => m.set(`${a.memberId}|${a.session}`, a));
    return m;
  }, [data.attendance]);

  const baseMembers = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.members.filter((m) => {
      if (roleF !== 'All' && m.role !== roleF) return false;
      return !t || [m.name, m.memberId, m.email, m.phone].some((v) => String(v).toLowerCase().includes(t));
    });
  }, [data.members, q, roleF]);

  const overallRows = useMemo(() => baseMembers.map((m) => {
    const marks = sessionIds.map((s) => lookup.has(`${m.memberId}|${s}`));
    const count = marks.filter(Boolean).length;
    return { m, marks, count, pct: Math.round((count / SESSION_COUNT) * 100) };
  }), [baseMembers, lookup]);

  const sessionRows = useMemo(() => baseMembers
    .map((m) => ({ m, rec: lookup.get(`${m.memberId}|${session}`) || null }))
    .filter((r) => statusF === 'All' || (statusF === 'Present' ? r.rec : !r.rec))
    .sort((a, b) => (a.rec && b.rec ? (a.rec.timestamp < b.rec.timestamp ? -1 : 1) : a.rec ? -1 : b.rec ? 1 : 0)),
  [baseMembers, lookup, session, statusF]);

  const rows = view === 'overall' ? overallRows : sessionRows;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const pageRows = rows.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const sessionName = (id) => (data.sessions.find((s) => s.id === id) || { name: `Session ${id}` }).name;

  /* ----- data builders for export ----- */
  const overallAOA = (list) => [
    ['Member ID', 'Name', 'Role', 'Email', 'Phone', 'Department', ...sessionIds.map((s) => `S${s}`), 'Sessions attended', 'Attendance %'],
    ...list.map(({ m, marks, count, pct }) => [m.memberId, m.name, m.role, m.email, m.phone, m.department, ...marks.map((x) => (x ? 'P' : 'A')), count, `${pct}%`]),
  ];
  const sessionAOA = (list) => [
    ['Member ID', 'Name', 'Role', 'Email', 'Phone', 'Department', 'Status', 'Marked at', 'Method'],
    ...list.map(({ m, rec }) => [m.memberId, m.name, m.role, m.email, m.phone, m.department, rec ? 'Present' : 'Absent', rec ? new Date(rec.timestamp).toLocaleString() : '', rec ? (rec.method === 'qr' ? 'QR scan' : 'Manual') : '']),
  ];
  const sessionRowsFor = (id, list) => list.map((m) => ({ m, rec: lookup.get(`${m.memberId}|${id}`) || null }));

  const exportCurrent = (kind) => {
    if (!rows.length) { notify('There is nothing to export.', 'warning'); return; }
    const base = view === 'overall' ? `calibrix2k26_overall_${stamp()}` : `calibrix2k26_session${session}_${stamp()}`;
    const aoa = view === 'overall' ? overallAOA(overallRows) : sessionAOA(sessionRows);
    if (kind === 'csv') downloadCSV(`${base}.csv`, aoa);
    else downloadXLSX(`${base}.xlsx`, [{ name: view === 'overall' ? 'Overall' : `Session ${session}`, rows: aoa }]);
  };

  const exportWorkbook = () => {
    if (!data.members.length) { notify('Add members before exporting.', 'warning'); return; }
    const all = data.members.map((m) => {
      const marks = sessionIds.map((s) => lookup.has(`${m.memberId}|${s}`));
      const count = marks.filter(Boolean).length;
      return { m, marks, count, pct: Math.round((count / SESSION_COUNT) * 100) };
    });
    const sheets = [{ name: 'Overall', rows: overallAOA(all) }];
    sessionIds.forEach((id) => sheets.push({ name: `S${id} ${sessionName(id)}`.slice(0, 31), rows: sessionAOA(sessionRowsFor(id, data.members)) }));
    downloadXLSX(`calibrix2k26_all_sessions_${stamp()}.xlsx`, sheets);
  };

  const presentInSession = data.attendance.filter((a) => a.session === session).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p>View records and export attendance to Excel or CSV.</p>
        </div>
        <button className="btn btn-outline-navy" onClick={exportWorkbook}><i className="bi bi-file-earmark-spreadsheet me-2" />Full workbook (all 12 sessions)</button>
      </div>

      <div className="panel">
        <div className="panel-head flex-wrap gap-2">
          <ul className="nav nav-pills mini-tabs">
            <li className="nav-item"><button className={`nav-link ${view === 'overall' ? 'active' : ''}`} onClick={() => { setView('overall'); setPage(1); }}>Overall</button></li>
            <li className="nav-item"><button className={`nav-link ${view === 'session' ? 'active' : ''}`} onClick={() => { setView('session'); setPage(1); }}>By session</button></li>
          </ul>
          <div className="d-flex gap-2 flex-wrap">
            <button className="btn btn-sm btn-teal" onClick={() => exportCurrent('xlsx')}><i className="bi bi-file-earmark-excel me-1" />Excel</button>
            <button className="btn btn-sm btn-outline-navy" onClick={() => exportCurrent('csv')}><i className="bi bi-filetype-csv me-1" />CSV</button>
          </div>
        </div>

        <div className="toolbar">
          {view === 'session' && (
            <select className="form-select w-auto" value={session} onChange={(e) => { setSession(Number(e.target.value)); setPage(1); }} aria-label="Session">
              {data.sessions.map((s) => <option key={s.id} value={s.id}>{s.id}. {s.name}</option>)}
            </select>
          )}
          <div className="input-group search-box">
            <span className="input-group-text"><i className="bi bi-search" /></span>
            <input className="form-control" placeholder="Search members…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <select className="form-select w-auto" value={roleF} onChange={(e) => { setRoleF(e.target.value); setPage(1); }} aria-label="Role">
            <option>All</option>{ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
          {view === 'session' && (
            <select className="form-select w-auto" value={statusF} onChange={(e) => { setStatusF(e.target.value); setPage(1); }} aria-label="Status">
              <option>All</option><option>Present</option><option>Absent</option>
            </select>
          )}
        </div>

        {view === 'session' && (
          <div className="px-3 pb-2 small text-muted">{sessionName(session)}: {presentInSession} present, {data.members.length - presentInSession} absent. Exports follow the filters above.</div>
        )}

        {data.members.length === 0 ? (
          <div className="empty-state"><i className="bi bi-file-earmark-bar-graph" /><p>No members yet. Reports appear once you add members.</p></div>
        ) : rows.length === 0 ? (
          <div className="empty-state small"><i className="bi bi-search" /><p>No records match these filters.</p></div>
        ) : view === 'overall' ? (
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0 matrix-table">
              <thead>
                <tr>
                  <th>Member</th><th>Role</th>
                  {sessionIds.map((s) => <th key={s} className="text-center" title={sessionName(s)}>{s}</th>)}
                  <th className="text-end">Total</th><th className="text-end">%</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(({ m, marks, count, pct }) => (
                  <tr key={m.memberId}>
                    <td className="text-nowrap"><div className="fw-semibold">{m.name}</div><div className="small text-muted">{m.memberId}</div></td>
                    <td><span className={`badge ${m.role === 'Office Bearer' ? 'badge-teal' : 'badge-navy'}`}>{m.role === 'Office Bearer' ? 'OB' : 'P'}</span></td>
                    {marks.map((x, i) => <td key={i} className="text-center"><span className={`dot ${x ? 'on' : ''}`}>{x ? <i className="bi bi-check-lg" /> : ''}</span></td>)}
                    <td className="text-end fw-bold">{count}</td>
                    <td className="text-end text-muted">{pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead><tr><th>Member</th><th className="d-none d-sm-table-cell">Role</th><th className="d-none d-lg-table-cell">Email</th><th>Status</th><th>Marked at</th><th className="d-none d-sm-table-cell">Method</th></tr></thead>
              <tbody>
                {pageRows.map(({ m, rec }) => (
                  <tr key={m.memberId}>
                    <td><div className="fw-semibold">{m.name}</div><div className="small text-muted">{m.memberId}</div></td>
                    <td className="d-none d-sm-table-cell"><span className={`badge ${m.role === 'Office Bearer' ? 'badge-teal' : 'badge-navy'}`}>{m.role}</span></td>
                    <td className="d-none d-lg-table-cell text-muted">{m.email || '—'}</td>
                    <td>{rec ? <span className="badge badge-present">Present</span> : <span className="badge badge-absent">Absent</span>}</td>
                    <td className="small">{rec ? formatDateTime(rec.timestamp) : '—'}</td>
                    <td className="d-none d-sm-table-cell small text-muted">{rec ? (rec.method === 'qr' ? 'QR scan' : 'Manual') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > PAGE_SIZE && (
          <div className="pager">
            <span className="small text-muted">{(cur - 1) * PAGE_SIZE + 1}–{Math.min(cur * PAGE_SIZE, rows.length)} of {rows.length}</span>
            <div className="btn-group">
              <button className="btn btn-sm btn-outline-navy" disabled={cur === 1} onClick={() => setPage(cur - 1)}><i className="bi bi-chevron-left" /></button>
              <button className="btn btn-sm btn-outline-navy disabled">{cur} / {pages}</button>
              <button className="btn btn-sm btn-outline-navy" disabled={cur === pages} onClick={() => setPage(cur + 1)}><i className="bi bi-chevron-right" /></button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
