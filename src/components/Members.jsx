import { useMemo, useRef, useState } from 'react';
import { useData } from '../store.jsx';
import Modal, { Confirm } from './Modal.jsx';
import { CSV_TEMPLATE, ROLES, csvToMembers, downloadBlob } from '../utils.js';

const BLANK = { name: '', role: 'Participant', email: '', phone: '', department: '' };
const PAGE_SIZE = 20;

export default function Members() {
  const { data, actions, notify } = useData();
  const [q, setQ] = useState('');
  const [roleF, setRoleF] = useState('All');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null); // { mode, memberId?, values }
  const [formError, setFormError] = useState('');
  const [imp, setImp] = useState(null); // { fileName, rows, errors }
  const [del, setDel] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.members.filter((m) => {
      if (roleF !== 'All' && m.role !== roleF) return false;
      if (!t) return true;
      return [m.name, m.memberId, m.email, m.phone, m.department].some((v) => String(v).toLowerCase().includes(t));
    });
  }, [data.members, q, roleF]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const rows = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  const openAdd = (role = 'Participant') => { setFormError(''); setForm({ mode: 'add', values: { ...BLANK, role } }); };
  const openEdit = (m) => { setFormError(''); setForm({ mode: 'edit', memberId: m.memberId, values: { name: m.name, role: m.role, email: m.email, phone: m.phone, department: m.department } }); };
  const setVal = (k, v) => setForm((f) => ({ ...f, values: { ...f.values, [k]: v } }));

  const submit = async (e, keepOpen) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const res = form.mode === 'add' ? await actions.addMember(form.values) : await actions.updateMember(form.memberId, form.values);
    setSaving(false);
    if (!res.ok) { setFormError(res.error); return; }
    if (form.mode === 'add') {
      notify(`${res.member.name} added as ${res.member.memberId}.`);
      if (keepOpen) { setFormError(''); setForm({ mode: 'add', values: { ...BLANK, role: form.values.role } }); return; }
    } else notify('Member updated.');
    setForm(null);
  };

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const { rows: parsed, errors } = csvToMembers(text);
      setImp({ fileName: file.name, rows: parsed, errors });
    } catch {
      notify('That file could not be read.', 'danger');
    }
  };

  const confirmImport = async () => {
    if (saving) return;
    setSaving(true);
    const { added, skipped, error } = await actions.importMembers(imp.rows);
    setSaving(false);
    if (error) notify(error, 'danger');
    if (error && !added) return;
    notify(`Imported ${added} member${added === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : ''}.`, added ? 'success' : 'warning');
    setImp(null);
    setPage(1);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Members</h1>
          <p>{data.members.length} total · {data.members.filter((m) => m.role === 'Participant').length} participants · {data.members.filter((m) => m.role === 'Office Bearer').length} office bearers</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-outline-navy" onClick={() => fileRef.current.click()}><i className="bi bi-filetype-csv me-2" />Import CSV</button>
          <button className="btn btn-outline-navy" onClick={() => openAdd('Office Bearer')}><i className="bi bi-award me-2" />Add office bearer</button>
          <button className="btn btn-teal" onClick={() => openAdd('Participant')}><i className="bi bi-person-plus me-2" />Add participant</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
          <div className="input-group search-box">
            <span className="input-group-text"><i className="bi bi-search" /></span>
            <input className="form-control" placeholder="Search name, ID, email, phone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <select className="form-select w-auto" value={roleF} onChange={(e) => { setRoleF(e.target.value); setPage(1); }} aria-label="Filter by role">
            <option>All</option>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>

        {data.members.length === 0 ? (
          <div className="empty-state">
            <i className="bi bi-people" />
            <h3>No members yet</h3>
            <p>Add people one by one, or import a CSV with columns: name, role, email, phone, department.</p>
            <div className="d-flex gap-2 justify-content-center flex-wrap">
              <button className="btn btn-teal" onClick={() => openAdd()}>Add first member</button>
              <button className="btn btn-outline-navy" onClick={() => downloadBlob('calibrix-members-template.csv', new Blob([CSV_TEMPLATE], { type: 'text/csv' }))}>Download CSV template</button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><i className="bi bi-search" /><p>No members match your search.</p></div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0 members-table">
              <thead>
                <tr><th>ID</th><th>Name</th><th>Role</th><th className="d-none d-md-table-cell">Email</th><th className="d-none d-lg-table-cell">Phone</th><th className="d-none d-lg-table-cell">Dept / College</th><th className="text-end">Actions</th></tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.memberId}>
                    <td><code className="id-chip">{m.memberId}</code></td>
                    <td className="fw-semibold">{m.name}</td>
                    <td><span className={`badge ${m.role === 'Office Bearer' ? 'badge-teal' : 'badge-navy'}`}>{m.role}</span></td>
                    <td className="d-none d-md-table-cell text-muted">{m.email || '—'}</td>
                    <td className="d-none d-lg-table-cell text-muted">{m.phone || '—'}</td>
                    <td className="d-none d-lg-table-cell text-muted">{m.department || '—'}</td>
                    <td className="text-end text-nowrap">
                      <button className="btn btn-sm btn-icon" title="Edit" onClick={() => openEdit(m)}><i className="bi bi-pencil" /></button>
                      <button className="btn btn-sm btn-icon danger" title="Delete" onClick={() => setDel(m)}><i className="bi bi-trash" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > PAGE_SIZE && (
          <div className="pager">
            <span className="small text-muted">Showing {(cur - 1) * PAGE_SIZE + 1}–{Math.min(cur * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="btn-group">
              <button className="btn btn-sm btn-outline-navy" disabled={cur === 1} onClick={() => setPage(cur - 1)}><i className="bi bi-chevron-left" /></button>
              <button className="btn btn-sm btn-outline-navy disabled">{cur} / {pages}</button>
              <button className="btn btn-sm btn-outline-navy" disabled={cur === pages} onClick={() => setPage(cur + 1)}><i className="bi bi-chevron-right" /></button>
            </div>
          </div>
        )}
      </div>

      {form && (
        <Modal
          title={form.mode === 'add' ? `Add ${form.values.role === 'Office Bearer' ? 'office bearer' : 'participant'}` : 'Edit member'}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn btn-light" onClick={() => setForm(null)}>Cancel</button>
              {form.mode === 'add' && <button className="btn btn-outline-navy" disabled={saving} onClick={(e) => submit(e, true)}>Save and add another</button>}
              <button className="btn btn-teal" disabled={saving} onClick={(e) => submit(e, false)}>{saving ? 'Saving…' : form.mode === 'add' ? 'Save member' : 'Save changes'}</button>
            </>
          }
        >
          <form onSubmit={(e) => submit(e, false)} noValidate>
            {formError && <div className="alert alert-danger py-2">{formError}</div>}
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label">Full name *</label>
                <input className="form-control" autoFocus value={form.values.name} onChange={(e) => setVal('name', e.target.value)} />
              </div>
              <div className="col-sm-6">
                <label className="form-label">Role</label>
                <select className="form-select" value={form.values.role} onChange={(e) => setVal('role', e.target.value)}>
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="col-sm-6">
                <label className="form-label">Phone</label>
                <input className="form-control" inputMode="tel" value={form.values.phone} onChange={(e) => setVal('phone', e.target.value)} />
              </div>
              <div className="col-12">
                <label className="form-label">Email</label>
                <input className="form-control" type="email" value={form.values.email} onChange={(e) => setVal('email', e.target.value)} />
              </div>
              <div className="col-12">
                <label className="form-label">Department / college</label>
                <input className="form-control" value={form.values.department} onChange={(e) => setVal('department', e.target.value)} />
              </div>
            </div>
            <button type="submit" hidden />
          </form>
        </Modal>
      )}

      {imp && (
        <Modal
          title="Import members from CSV"
          size="lg"
          onClose={() => setImp(null)}
          footer={
            <>
              <button className="btn btn-light" onClick={() => setImp(null)}>Cancel</button>
              <button className="btn btn-teal" disabled={!imp.rows.length || saving} onClick={confirmImport}>{saving ? 'Importing…' : `Import ${imp.rows.length} member${imp.rows.length === 1 ? '' : 's'}`}</button>
            </>
          }
        >
          <p className="mb-2"><strong>{imp.fileName}</strong>: {imp.rows.length} valid row{imp.rows.length === 1 ? '' : 's'} found. Members with an email or name and phone already in the list are skipped.</p>
          {imp.errors.length > 0 && (
            <div className="alert alert-warning py-2 small">
              {imp.errors.slice(0, 5).map((er) => <div key={er}>{er}</div>)}
              {imp.errors.length > 5 && <div>…and {imp.errors.length - 5} more.</div>}
            </div>
          )}
          {imp.rows.length > 0 && (
            <div className="table-responsive">
              <table className="table table-sm small">
                <thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Phone</th><th>Dept</th></tr></thead>
                <tbody>
                  {imp.rows.slice(0, 8).map((r, i) => (
                    <tr key={i}><td>{r.name}</td><td>{r.role}</td><td>{r.email}</td><td>{r.phone}</td><td>{r.department}</td></tr>
                  ))}
                </tbody>
              </table>
              {imp.rows.length > 8 && <div className="small text-muted">Showing the first 8 rows.</div>}
            </div>
          )}
          <button className="btn btn-link p-0 small" onClick={() => downloadBlob('calibrix-members-template.csv', new Blob([CSV_TEMPLATE], { type: 'text/csv' }))}>Download CSV template</button>
        </Modal>
      )}

      {del && (
        <Confirm
          title="Delete member?"
          danger
          confirmText="Delete"
          message={<>Delete <strong>{del.name}</strong> ({del.memberId})? Their attendance records in all sessions will also be removed. This cannot be undone.</>}
          onCancel={() => setDel(null)}
          onConfirm={async () => { const r = await actions.deleteMember(del.memberId); if (r.ok) notify('Member deleted.'); else notify(r.error, 'danger'); setDel(null); }}
        />
      )}
    </>
  );
}
