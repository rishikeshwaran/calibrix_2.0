import { useCallback, useEffect, useState } from "react";
import Dashboard from "./components/Dashboard.jsx";
import Members from "./components/Members.jsx";
import QRCodes from "./components/QRCodes.jsx";
import Attendance from "./components/Attendance.jsx";
import Reports from "./components/Reports.jsx";
import Backup from "./components/Backup.jsx";
import { SESSION_COUNT } from "./utils.js";
import { useAuth } from "./auth.jsx";
import { useData } from "./store.jsx";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "bi-grid-1x2-fill" },
  { id: "members", label: "Members", icon: "bi-people-fill" },
  { id: "qr", label: "QR codes", icon: "bi-qr-code" },
  { id: "attendance", label: "Attendance", icon: "bi-check2-square" },
  { id: "reports", label: "Reports", icon: "bi-file-earmark-bar-graph-fill" },
  { id: "backup", label: "Backup", icon: "bi-hdd-fill" },
];

const SESSION_KEY = "calibrix2k26_active_session";
const readPage = () => {
  const h = window.location.hash.replace(/^#\/?/, "");
  return NAV.some((n) => n.id === h) ? h : "dashboard";
};
const readSession = () => {
  try {
    const n = Number(localStorage.getItem(SESSION_KEY));
    return n >= 1 && n <= SESSION_COUNT ? n : 1;
  } catch {
    return 1;
  }
};

const SYNC = {
  live: { text: "Live · shared", icon: "bi-cloud-check-fill" },
  syncing: { text: "Syncing…", icon: "bi-arrow-repeat" },
  offline: { text: "Offline · will sync", icon: "bi-wifi-off" },
};

function SyncPill({ status }) {
  const s = SYNC[status];
  return (
    <span className={`sync-pill ${status}`}>
      <i className={`bi ${s.icon}`} />
      {s.text}
    </span>
  );
}

export default function App() {
  const { logout } = useAuth();
  const { status } = useData();
  const [page, setPage] = useState(readPage);
  const [session, setSessionState] = useState(readSession);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onHash = () => {
      setPage(readPage());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = useCallback((id) => {
    window.location.hash = `/${id}`;
    setMenuOpen(false);
  }, []);

  const setSession = useCallback((n) => {
    setSessionState(n);
    try {
      localStorage.setItem(SESSION_KEY, String(n));
    } catch {
      /* optional */
    }
  }, []);

  const title = NAV.find((n) => n.id === page).label;

  return (
    <div className="app-shell">
      <aside className={`sidebar no-print ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <i className="bi bi-qr-code-scan" />
          </div>
          <div>
            <div className="brand-name">CALIBRIX</div>
            <div className="brand-sub">2.0 Attendance</div>
          </div>
        </div>
        <nav className="nav flex-column">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`side-link ${page === n.id ? "active" : ""}`}
              onClick={() => go(n.id)}
            >
              <i className={`bi ${n.icon}`} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <SyncPill status={status} />
          <span>Shared live with every phone signed in to this event.</span>
          <button
            className="btn btn-sm btn-outline-light mt-1"
            onClick={logout}
          >
            <i className="bi bi-box-arrow-right me-2" />
            Sign out
          </button>
        </div>
      </aside>
      {menuOpen && (
        <div className="scrim no-print" onClick={() => setMenuOpen(false)} />
      )}

      <div className="main-col">
        <header className="topbar no-print">
          <button
            className="menu-btn"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <i className="bi bi-list" />
          </button>
          <span className="topbar-title">{title}</span>
          <SyncPill status={status} />
        </header>
        <main className="content">
          {page === "dashboard" && (
            <Dashboard go={go} setSession={setSession} />
          )}
          {page === "members" && <Members />}
          {page === "qr" && <QRCodes />}
          {page === "attendance" && (
            <Attendance session={session} setSession={setSession} />
          )}
          {page === "reports" && (
            <Reports session={session} setSession={setSession} />
          )}
          {page === "backup" && <Backup />}
        </main>
        <footer className="app-footer no-print">
          CALIBRIX 2.0 · Attendance is saved to the event database and shared
          live across all signed-in phones.
        </footer>
      </div>
    </div>
  );
}
