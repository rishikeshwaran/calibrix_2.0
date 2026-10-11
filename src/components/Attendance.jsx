import { useMemo, useRef, useState } from 'react';
import { useData } from '../store.jsx';
import Scanner from './Scanner.jsx';
import { beep, formatDateTime, parseQrPayload } from '../utils.js';

const LIST_LIMIT = 100;

export default function Attendance({ session, setSession }) {
  const { data, actions } = useData();
  const [q, setQ] = useState('');
  const [result, setResult] = useState(null); // { type, title, detail }
  const [tab, setTab] = useState('present');
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const searchRef = useRef(null);

  const current = data.sessions.find((s) => s.id === session) || data.sessions[0];

  const info = useMemo(() => {
    const recs = data.attendance.filter((a) => a.session === session);
    const map = new Map(recs.map((r) => [r.memberId, r]));
    const present = recs
      .map((r) => ({ rec: r, member: data.members.find((m) => m.memberId === r.memberId) }))
      .filter((x) => x.member)
      .sort((a, b) => (a.rec.timestamp < b.rec.timestamp ? 1 : -1));
    const absent = data.members.filter((m) => !map.has(m.memberId));
    const counts = new Map();
    data.attendance.forEach((a) => counts.set(a.session, (counts.get(a.session) || 0) + 1));
    return { map, present, absent, counts };
  }, [data, session]);

  const mark = (memberId, method) => {
    const res = actions.markAttendance(memberId, session, method);
    if (res.status === 'ok') {
      beep('ok');
      setResult({ type: 'ok', title: `${res.member.name} marked present`, detail: `${res.member.memberId} · ${res.member.role} · ${current.name}` });
    } else if (res.status === 'duplicate') {
      beep('bad');
      setResult({ type: 'dup', title: `${res.member.name} is already marked`, detail: `Present in ${current.name} since ${formatDateTime(res.record.timestamp)}. Not counted twice.` });
    } else {
      beep('bad');
      setResult({ type: 'bad', title: 'Member not found', detail: `No member matches “${String(memberId).slice(0, 40)}”. Check the QR code or add the member first.` });
    }
    return res;
  };

  const onScan = (text) => mark(parseQrPayload(text), 'qr');

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return data.members
      .filter((m) => [m.name, m.memberId, m.email, m.phone].some((v) => String(v).toLowerCase().includes(t)))
      .slice(0, 8);
  }, [data.members, q]);

  // Pressing Enter marks an exact ID / QR text match. This also works with USB barcode scanners.
  const onSearchKey = (e) => {
    if (e.key !== 'Enter') return;
    const raw = parseQrPayload(q);
    const exact = data.members.find((m) => m.memberId.toLowerCase() === raw.toLowerCase());
    const target = exact || (results.length === 1 ? results[0] : null);
    if (target) { mark(target.memberId, exact ? 'qr' : 'manual'); setQ(''); }
    else if (q.trim()) setResult({ type: 'bad', title: 'Pick a member from the list', detail: results.length ? 'More than one member matches. Tap Mark present on the right one.' : 'No member matches your search.' });
  };

  const saveName = () => { actions.renameSession(current.id, nameDraft); setEditing(false); };
  const total = data.members.length;
  const presentCount = info.present.length;
  const pct = total ? Math.round((presentCount / total) * 100) : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Attendance</h1>
          <p>Pick a session, then scan a QR code or search for a member.</p>
        </div>
      </div>

      <div className="panel mb-4">
        <div className="panel-head"><h2>Choose session</h2></div>
        <div className="session-picker">
          {data.sessions.map((s) => (
            <button key={s.id} className={`session-pill ${s.id === session ? 'active' : ''}`} onClick={() => { setSession(s.id); setResult(null); }} title={s.name}>
              <span className="n">{s.id}</span>
              <span className="c">{info.counts.get(s.id) || 0}</span>
            </button>
          ))}
        </div>
        <div className="current-session">
          {editing ? (
            <form className="d-flex gap-2 flex-grow-1" onSubmit={(e) => { e.preventDefault(); saveName(); }}>
              <input className="form-control" autoFocus value={nameDraft} maxLength={40} onChange={(e) => setNameDraft(e.target.value)} />
              <button className="btn btn-teal" type="submit">Save</button>
              <button className="btn btn-light" type="button" onClick={() => setEditing(false)}>Cancel</button>
            </form>
          ) : (
            <>
              <div>
                <div className="fs-5 fw-bold">{current.name}</div>
                <div className="text-muted small">{presentCount} of {total} present ({pct}%)</div>
              </div>
              <button className="btn btn-sm btn-outline-navy" onClick={() => { setNameDraft(current.name); setEditing(true); }}><i className="bi bi-pencil me-1" />Rename</button>
            </>
          )}
        </div>
      </div>

      {result && (
        <div className={`result-banner ${result.type}`} role="status">
          <i className={`bi ${result.type === 'ok' ? 'bi-check-circle-fill' : result.type === 'dup' ? 'bi-exclamation-triangle-fill' : 'bi-x-octagon-fill'}`} />
          <div className="flex-grow-1">
            <div className="fw-bold">{result.title}</div>
            <div className="small">{result.detail}</div>
          </div>
          <button className="btn-close" aria-label="Dismiss" onClick={() => setResult(null)} />
        </div>
      )}

      <div className="row g-4 mb-4">
        <div className="col-lg-6">
          <div className="panel h-100">
            <div className="panel-head"><h2>Scan QR code</h2></div>
            <div className="p-3 pt-0"><Scanner onScan={onScan} /></div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="panel h-100">
            <div className="panel-head"><h2>Search manually</h2></div>
            <div className="p-3 pt-0">
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-search" /></span>
                <input ref={searchRef} className="form-control" placeholder="Name, ID, email or phone. Press Enter to mark." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearchKey} />
              </div>
              <div className="search-results">
                {q.trim() && results.length === 0 && <div className="text-muted small py-3">No members match “{q}”.</div>}
                {results.map((m) => {
                  const rec = info.map.get(m.memberId);
                  return (
                    <div key={m.memberId} className="result-row">
                      <div className="avatar">{m.name.charAt(0).toUpperCase()}</div>
                      <div className="flex-grow-1 min-w-0">
                        <div className="fw-semibold text-truncate">{m.name}</div>
                        <div className="small text-muted">{m.memberId} · {m.role}</div>
                      </div>
                      {rec ? (
                        <span className="badge badge-present"><i className="bi bi-check2 me-1" />Present</span>
                      ) : (
                        <button className="btn btn-sm btn-teal" onClick={() => { mark(m.memberId, 'manual'); setQ(''); searchRef.current && searchRef.current.focus(); }}>Mark present</button>
                      )}
                    </div>
                  );
                })}
                {!q.trim() && <div className="text-muted small py-3">Type to find a member. A USB barcode scanner also works here: click this box and scan.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <ul className="nav nav-pills mini-tabs">
            <li className="nav-item"><button className={`nav-link ${tab === 'present' ? 'active' : ''}`} onClick={() => setTab('present')}>Present ({presentCount})</button></li>
            <li className="nav-item"><button className={`nav-link ${tab === 'absent' ? 'active' : ''}`} onClick={() => setTab('absent')}>Not marked ({info.absent.length})</button></li>
          </ul>
        </div>
        {tab === 'present' ? (
          info.present.length === 0 ? (
            <div className="empty-state small"><i className="bi bi-person-check" /><p>No one is marked in {current.name} yet.</p></div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead><tr><th>Member</th><th className="d-none d-sm-table-cell">Role</th><th>Time</th><th className="d-none d-sm-table-cell">Method</th><th /></tr></thead>
                <tbody>
                  {info.present.slice(0, LIST_LIMIT).map(({ rec, member }) => (
                    <tr key={rec.memberId}>
                      <td><div className="fw-semibold">{member.name}</div><div className="small text-muted">{member.memberId}</div></td>
                      <td className="d-none d-sm-table-cell"><span className={`badge ${member.role === 'Office Bearer' ? 'badge-teal' : 'badge-navy'}`}>{member.role}</span></td>
                      <td className="small">{formatDateTime(rec.timestamp)}</td>
                      <td className="d-none d-sm-table-cell small text-muted">{rec.method === 'qr' ? 'QR scan' : 'Manual'}</td>
                      <td className="text-end"><button className="btn btn-sm btn-icon danger" title="Undo attendance" onClick={() => { actions.removeAttendance(rec.memberId, session); setResult(null); }}><i className="bi bi-arrow-counterclockwise" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {info.present.length > LIST_LIMIT && <div className="small text-muted p-3">Showing the latest {LIST_LIMIT}. See Reports for the full list.</div>}
            </div>
          )
        ) : info.absent.length === 0 ? (
          <div className="empty-state small"><i className="bi bi-emoji-smile" /><p>{total ? 'Everyone is marked present.' : 'No members yet.'}</p></div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead><tr><th>Member</th><th className="d-none d-sm-table-cell">Role</th><th /></tr></thead>
              <tbody>
                {info.absent.slice(0, LIST_LIMIT).map((m) => (
                  <tr key={m.memberId}>
                    <td><div className="fw-semibold">{m.name}</div><div className="small text-muted">{m.memberId}</div></td>
                    <td className="d-none d-sm-table-cell"><span className={`badge ${m.role === 'Office Bearer' ? 'badge-teal' : 'badge-navy'}`}>{m.role}</span></td>
                    <td className="text-end"><button className="btn btn-sm btn-teal" onClick={() => mark(m.memberId, 'manual')}>Mark present</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {info.absent.length > LIST_LIMIT && <div className="small text-muted p-3">Showing {LIST_LIMIT} of {info.absent.length}. Use search above to find others.</div>}
          </div>
        )}
      </div>
    </>
  );
}
