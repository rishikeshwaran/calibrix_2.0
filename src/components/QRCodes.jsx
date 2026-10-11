import { useEffect, useMemo, useState } from 'react';
import { useData } from '../store.jsx';
import QRImage from './QRImage.jsx';
import { ROLES, downloadQrPng } from '../utils.js';

const PAGE_SIZE = 24;

export default function QRCodes() {
  const { data, notify } = useData();
  const [q, setQ] = useState('');
  const [roleF, setRoleF] = useState('All');
  const [shown, setShown] = useState(PAGE_SIZE);
  const [printing, setPrinting] = useState(false);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.members.filter((m) => {
      if (roleF !== 'All' && m.role !== roleF) return false;
      return !t || [m.name, m.memberId, m.email].some((v) => String(v).toLowerCase().includes(t));
    });
  }, [data.members, q, roleF]);

  const list = printing ? filtered : filtered.slice(0, shown);

  // Render every card first so all QR images exist, then open the print dialog.
  const printAll = () => {
    setPrinting(true);
    setTimeout(() => window.print(), 600 + filtered.length * 12);
  };
  useEffect(() => {
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    return () => window.removeEventListener('afterprint', done);
  }, []);

  const download = async (m) => {
    try { await downloadQrPng(m); } catch { notify('Could not create the QR image.', 'danger'); }
  };

  return (
    <>
      <div className="page-head no-print">
        <div>
          <h1>QR codes</h1>
          <p>Each member has one permanent QR code. The same code works for all 12 sessions.</p>
        </div>
        <button className="btn btn-teal" disabled={!filtered.length || printing} onClick={printAll}>
          <i className="bi bi-printer me-2" />{printing ? 'Preparing…' : `Print ${filtered.length} QR code${filtered.length === 1 ? '' : 's'}`}
        </button>
      </div>

      <div className="panel no-print mb-3">
        <div className="toolbar">
          <div className="input-group search-box">
            <span className="input-group-text"><i className="bi bi-search" /></span>
            <input className="form-control" placeholder="Search by name or ID…" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE_SIZE); }} />
          </div>
          <select className="form-select w-auto" value={roleF} onChange={(e) => { setRoleF(e.target.value); setShown(PAGE_SIZE); }} aria-label="Filter by role">
            <option>All</option>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="small text-muted px-3 pb-3">Tip: choose “Save as PDF” in the print dialog to get a shareable sheet of badges.</div>
      </div>

      {data.members.length === 0 ? (
        <div className="panel empty-state no-print"><i className="bi bi-qr-code" /><h3>No QR codes yet</h3><p>Add members first. A QR code is created automatically for each one.</p></div>
      ) : filtered.length === 0 ? (
        <div className="panel empty-state no-print"><i className="bi bi-search" /><p>No members match your search.</p></div>
      ) : (
        <>
          <div className="qr-grid">
            {list.map((m) => (
              <div key={m.memberId} className="qr-card">
                <div className="qr-card-head">CALIBRIX 2K26</div>
                <QRImage memberId={m.memberId} size={170} />
                <div className="qr-name" title={m.name}>{m.name}</div>
                <div className="qr-meta"><code>{m.memberId}</code><span>{m.role}</span></div>
                <button className="btn btn-sm btn-outline-navy no-print" onClick={() => download(m)}><i className="bi bi-download me-1" />PNG</button>
              </div>
            ))}
          </div>
          {!printing && filtered.length > shown && (
            <div className="text-center mt-3 no-print">
              <button className="btn btn-outline-navy" onClick={() => setShown(shown + PAGE_SIZE)}>Show more ({filtered.length - shown} left)</button>
            </div>
          )}
        </>
      )}
    </>
  );
}
