import { useRef, useState } from 'react';
import { isValidBackup, useData } from '../store.jsx';
import Modal, { Confirm } from './Modal.jsx';
import { downloadJSON, stamp } from '../utils.js';

export default function Backup() {
  const { data, actions, notify } = useData();
  const [pending, setPending] = useState(null); // { fileName, obj, mode }
  const [resetOpen, setResetOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const exportBackup = () => {
    downloadJSON(`calibrix2k26_backup_${stamp()}.json`, actions.getBackup());
    notify('Backup file downloaded. Keep it somewhere safe.');
  };

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      if (!isValidBackup(obj)) throw new Error('bad');
      setPending({ fileName: file.name, obj, mode: 'merge' });
    } catch {
      notify('That is not a valid CALIBRIX backup file.', 'danger');
    }
  };

  const doRestore = async () => {
    setBusy(true);
    try {
      const res = await actions.restore(pending.obj, pending.mode);
      notify(pending.mode === 'replace'
        ? `Restored ${res.members} members and ${res.attendance} attendance records.`
        : `Merged ${res.members} new members and ${res.attendance} new attendance records.`);
      setPending(null);
    } catch (e) {
      notify((e && e.message) || 'Restore failed.', 'danger');
    }
    setBusy(false);
  };

  const doReset = async () => {
    if (typed.trim() !== 'DELETE') { notify('Type DELETE to confirm.', 'warning'); return; }
    setBusy(true);
    try { await actions.resetAll(); notify('All data erased.'); setResetOpen(false); }
    catch (e) { notify((e && e.message) || 'Could not erase data.', 'danger'); }
    setBusy(false);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Backup and restore</h1>
          <p>Keep a safety copy of everything as a JSON file, or load one back in.</p>
        </div>
      </div>

      <div className="alert alert-info d-flex gap-3 align-items-start">
        <i className="bi bi-cloud-check-fill fs-5" />
        <div>
          <strong>Your data is shared live on all phones.</strong> It is saved in the event's Firebase database, so every phone signed in with the passcode sees the same members and attendance. A backup file is still a good idea after each session.
        </div>
      </div>

      <div className="row g-4">
        <div className="col-md-6">
          <div className="panel h-100 p-4">
            <div className="action-icon"><i className="bi bi-download" /></div>
            <h2 className="h5">Export backup</h2>
            <p className="text-muted">Downloads all members, attendance records and session names as one JSON file.</p>
            <div className="small text-muted mb-3">{data.members.length} members · {data.attendance.length} attendance records</div>
            <button className="btn btn-teal" onClick={exportBackup}>Download backup</button>
          </div>
        </div>
        <div className="col-md-6">
          <div className="panel h-100 p-4">
            <div className="action-icon"><i className="bi bi-upload" /></div>
            <h2 className="h5">Restore from backup</h2>
            <p className="text-muted">Choose a backup JSON file. Backups from the earlier LocalStorage version work too.</p>
            <button className="btn btn-outline-navy" onClick={() => fileRef.current.click()}>Choose backup file</button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFile} />
          </div>
        </div>
        <div className="col-12">
          <div className="panel p-4 danger-zone">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
              <div>
                <h2 className="h5 mb-1">Erase all data</h2>
                <p className="text-muted mb-0">Removes every member and attendance record for <strong>all phones</strong>. Export a backup first.</p>
              </div>
              <button className="btn btn-outline-danger" onClick={() => { setTyped(''); setResetOpen(true); }}>Erase everything</button>
            </div>
          </div>
        </div>
      </div>

      {pending && (
        <Modal
          title="Restore backup"
          onClose={() => !busy && setPending(null)}
          footer={
            <>
              <button className="btn btn-light" disabled={busy} onClick={() => setPending(null)}>Cancel</button>
              <button className={`btn ${pending.mode === 'replace' ? 'btn-danger' : 'btn-teal'}`} disabled={busy} onClick={doRestore}>
                {busy ? 'Working…' : pending.mode === 'replace' ? 'Replace shared data' : 'Merge into shared data'}
              </button>
            </>
          }
        >
          <p className="mb-2"><strong>{pending.fileName}</strong> contains {pending.obj.members.length} members and {pending.obj.attendance.length} attendance records{pending.obj.exportedAt ? ` (exported ${new Date(pending.obj.exportedAt).toLocaleString()})` : ''}.</p>
          <div className="form-check mb-2">
            <input className="form-check-input" type="radio" id="m-merge" checked={pending.mode === 'merge'} onChange={() => setPending({ ...pending, mode: 'merge' })} />
            <label className="form-check-label" htmlFor="m-merge"><strong>Merge</strong>: add members and attendance that are not already there. Nothing is deleted.</label>
          </div>
          <div className="form-check">
            <input className="form-check-input" type="radio" id="m-replace" checked={pending.mode === 'replace'} onChange={() => setPending({ ...pending, mode: 'replace' })} />
            <label className="form-check-label" htmlFor="m-replace"><strong>Replace</strong>: deletes the current shared data for everyone, then loads the file.</label>
          </div>
        </Modal>
      )}

      {resetOpen && (
        <Confirm
          title="Erase all data?"
          danger
          confirmText={busy ? 'Erasing…' : 'Erase everything'}
          message={
            <>
              <p>This permanently deletes all members and attendance for every phone. Type <strong>DELETE</strong> to confirm.</p>
              <input className="form-control" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="DELETE" />
            </>
          }
          onCancel={() => !busy && setResetOpen(false)}
          onConfirm={doReset}
        />
      )}
    </>
  );
}
