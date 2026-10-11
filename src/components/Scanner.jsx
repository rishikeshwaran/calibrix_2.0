import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const REGION_ID = 'calibrix-qr-reader';

export default function Scanner({ onScan }) {
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scannerRef = useRef(null);
  const lastRef = useRef({ text: '', time: 0 });
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const start = async () => {
    setError('');
    setBusy(true);
    try {
      const scanner = new Html5Qrcode(REGION_ID, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (w, h) => {
            const side = Math.floor(Math.min(w, h) * 0.75);
            return { width: side, height: side };
          },
        },
        (text) => {
          const now = Date.now();
          // Ignore the same code for 3 seconds so one scan is not processed repeatedly.
          if (text === lastRef.current.text && now - lastRef.current.time < 3000) return;
          lastRef.current = { text, time: now };
          onScanRef.current(text);
        },
        () => {}
      );
      setRunning(true);
    } catch (e) {
      scannerRef.current = null;
      const msg = String((e && e.message) || e);
      setError(
        /permission|denied|NotAllowed/i.test(msg)
          ? 'Camera permission was denied. Allow camera access in your browser settings and try again.'
          : /secure|https/i.test(msg) || !window.isSecureContext
            ? 'The camera needs a secure page. Open the site on localhost or over HTTPS.'
            : 'Could not start the camera. Check that no other app is using it.'
      );
    }
    setBusy(false);
  };

  const stop = async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try { await s.stop(); s.clear(); } catch { /* already stopped */ }
    }
    setRunning(false);
  };

  useEffect(() => () => {
    const s = scannerRef.current;
    if (s) s.stop().then(() => s.clear()).catch(() => {});
  }, []);

  return (
    <div>
      <div className={`scanner-frame ${running ? 'live' : ''}`}>
        <div id={REGION_ID} />
        {!running && (
          <div className="scanner-idle">
            <i className="bi bi-qr-code-scan" />
            <span>Camera is off</span>
          </div>
        )}
      </div>
      {error && <div className="alert alert-warning py-2 mt-2 mb-0 small">{error}</div>}
      <div className="d-grid mt-3">
        {running ? (
          <button className="btn btn-outline-navy" onClick={stop}><i className="bi bi-stop-circle me-2" />Stop camera</button>
        ) : (
          <button className="btn btn-teal" onClick={start} disabled={busy}>
            <i className="bi bi-camera-video me-2" />{busy ? 'Starting camera…' : 'Start camera scanner'}
          </button>
        )}
      </div>
    </div>
  );
}
