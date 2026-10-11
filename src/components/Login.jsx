import { useState } from 'react';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { signIn } = useAuth();
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!pass) { setError('Enter the event passcode.'); return; }
    setBusy(true); setError('');
    const res = await signIn(pass);
    if (!res.ok) setError(res.error);
    setBusy(false);
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="brand-mark mx-auto mb-3"><i className="bi bi-qr-code-scan" /></div>
        <h1>CALIBRIX 2K26</h1>
        <p className="text-muted">Enter the event passcode to open attendance.</p>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        <label className="form-label" htmlFor="pass">Event passcode</label>
        <div className="input-group mb-3">
          <input id="pass" className="form-control form-control-lg" type={show ? 'text' : 'password'} autoFocus autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} />
          <button type="button" className="btn btn-outline-navy" onClick={() => setShow(!show)} aria-label={show ? 'Hide passcode' : 'Show passcode'}><i className={`bi ${show ? 'bi-eye-slash' : 'bi-eye'}`} /></button>
        </div>
        <button className="btn btn-teal btn-lg w-100" disabled={busy}>{busy ? 'Checking…' : 'Open attendance'}</button>
        <div className="small text-muted mt-3">You stay signed in on this phone until you tap Sign out.</div>
      </form>
    </div>
  );
}
