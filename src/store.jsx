import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, runTransaction, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase.js';
import { useAuth } from './auth.jsx';
import Splash from './components/Splash.jsx';
import { SESSION_COUNT, ROLES, formatMemberId, maxIdNumber } from './utils.js';

export const APP_ID = 'CALIBRIX2K26';

const defaultSessions = () =>
  Array.from({ length: SESSION_COUNT }, (_, i) => ({ id: i + 1, name: `Session ${i + 1}` }));

const attId = (memberId, session) => `${memberId}_S${session}`;
const byId = (a, b) => a.memberId.localeCompare(b.memberId, undefined, { numeric: true });

function cleanMember(m, fallbackId) {
  const memberId = String((m && m.memberId) || fallbackId || '');
  if (!memberId || !m || !m.name) return null;
  return {
    memberId,
    name: String(m.name),
    role: ROLES.includes(m.role) ? m.role : 'Participant',
    email: String(m.email || ''),
    phone: String(m.phone || ''),
    department: String(m.department || ''),
    createdAt: m.createdAt || new Date().toISOString(),
  };
}

function cleanAttendance(a) {
  const s = Number(a && a.session);
  if (!a || !a.memberId || !(s >= 1 && s <= SESSION_COUNT)) return null;
  return { memberId: String(a.memberId), session: s, timestamp: a.timestamp || new Date().toISOString(), method: a.method || 'manual' };
}

/** Sanitises a backup file (also accepts backups from the older LocalStorage version). */
function clean(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const members = (Array.isArray(d.members) ? d.members : []).map((m) => cleanMember(m)).filter(Boolean);
  const seen = new Set();
  const attendance = [];
  (Array.isArray(d.attendance) ? d.attendance : []).forEach((a) => {
    const rec = cleanAttendance(a);
    if (!rec) return;
    const key = attId(rec.memberId, rec.session);
    if (seen.has(key)) return;
    seen.add(key);
    attendance.push(rec);
  });
  const sessions = defaultSessions().map((s) => {
    const f = Array.isArray(d.sessions) ? d.sessions.find((x) => x && Number(x.id) === s.id) : null;
    return f && f.name ? { id: s.id, name: String(f.name) } : s;
  });
  return { members, attendance, sessions };
}

function friendly(e) {
  const code = e && e.code;
  if (code === 'permission-denied') return 'Not allowed. Check that you are signed in and the Firestore rules are published.';
  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'failed-precondition') return 'No internet connection. Try again when you are online.';
  return (e && e.message) || 'Something went wrong.';
}

async function commitOps(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach((op) => (op.type === 'delete' ? batch.delete(op.ref) : batch.set(op.ref, op.data)));
    await batch.commit();
  }
}

const Ctx = createContext(null);
export const useData = () => useContext(Ctx);

export function DataProvider({ children }) {
  const { logout } = useAuth();
  const ref = useRef({ members: [], attendance: [], sessions: defaultSessions() });
  const loaded = useRef({ members: false, attendance: false });
  const pend = useRef({ members: false, attendance: false });
  const [data, setData] = useState(ref.current);
  const [ready, setReady] = useState({ members: false, attendance: false, sessions: false });
  const [pending, setPending] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [fatal, setFatal] = useState('');
  const [toasts, setToasts] = useState([]);

  const notify = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  /* ---------- live listeners ---------- */
  useEffect(() => {
    const apply = (patch) => { ref.current = { ...ref.current, ...patch }; setData(ref.current); };
    const markReady = (k) => setReady((r) => (r[k] ? r : { ...r, [k]: true }));
    const onErr = (e) => setFatal(friendly(e));

    const watch = (name, mapper, sorter) =>
      onSnapshot(collection(db, name), { includeMetadataChanges: true }, (snap) => {
        pend.current[name] = snap.metadata.hasPendingWrites;
        setPending(pend.current.members || pend.current.attendance);
        if (!loaded.current[name] || snap.docChanges().length > 0) {
          const list = snap.docs.map((d) => mapper(d.data(), d.id)).filter(Boolean);
          if (sorter) list.sort(sorter);
          apply({ [name]: list });
        }
        loaded.current[name] = true;
        if (!snap.metadata.fromCache || snap.docs.length > 0) markReady(name);
      }, onErr);

    const unsubs = [
      watch('members', cleanMember, byId),
      watch('attendance', (d) => cleanAttendance(d)),
      onSnapshot(doc(db, 'meta', 'sessions'), (snap) => {
        const names = (snap.exists() && snap.data().names) || {};
        apply({ sessions: defaultSessions().map((s) => ({ id: s.id, name: names[s.id] || s.name })) });
        markReady('sessions');
      }, onErr),
    ];
    // If the phone is offline and nothing is cached yet, do not wait forever.
    const timer = setTimeout(() => setReady({ members: true, attendance: true, sessions: true }), 4000);

    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      unsubs.forEach((u) => u());
      clearTimeout(timer);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  /* ---------- actions ---------- */
  const actions = useMemo(() => {
    const cur = () => ref.current;
    const counterRef = () => doc(db, 'meta', 'counters');
    const dupKey = (m) => (m.email ? `e:${m.email.toLowerCase()}` : `n:${m.name.toLowerCase()}|${m.phone}`);
    const readSeq = (snap) => (snap.exists() ? Number(snap.data().memberSeq) || 0 : 0);
    const offlineMsg = 'You are offline. Adding or changing members needs an internet connection.';

    return {
      async addMember(fields) {
        const name = String(fields.name || '').trim();
        if (!name) return { ok: false, error: 'Name is required.' };
        const email = String(fields.email || '').trim();
        if (email && cur().members.some((m) => m.email.toLowerCase() === email.toLowerCase()))
          return { ok: false, error: 'A member with this email already exists.' };
        if (!navigator.onLine) return { ok: false, error: offlineMsg };
        try {
          // A transaction hands out the next ID so two phones can never get the same one.
          const member = await runTransaction(db, async (tx) => {
            const cs = await tx.get(counterRef());
            const base = Math.max(readSeq(cs), maxIdNumber(cur().members));
            const memberId = formatMemberId(base + 1);
            const mref = doc(db, 'members', memberId);
            const existing = await tx.get(mref);
            if (existing.exists()) throw new Error('That ID was just taken by another device. Please try again.');
            const m = {
              memberId, name,
              role: ROLES.includes(fields.role) ? fields.role : 'Participant',
              email, phone: String(fields.phone || '').trim(), department: String(fields.department || '').trim(),
              createdAt: new Date().toISOString(),
            };
            tx.set(counterRef(), { memberSeq: base + 1 }, { merge: true });
            tx.set(mref, m);
            return m;
          });
          return { ok: true, member };
        } catch (e) {
          return { ok: false, error: friendly(e) };
        }
      },

      async updateMember(memberId, fields) {
        const name = String(fields.name || '').trim();
        if (!name) return { ok: false, error: 'Name is required.' };
        const email = String(fields.email || '').trim();
        if (email && cur().members.some((m) => m.memberId !== memberId && m.email.toLowerCase() === email.toLowerCase()))
          return { ok: false, error: 'Another member already uses this email.' };
        if (!navigator.onLine) return { ok: false, error: offlineMsg };
        try {
          await updateDoc(doc(db, 'members', memberId), {
            name, email,
            role: ROLES.includes(fields.role) ? fields.role : 'Participant',
            phone: String(fields.phone || '').trim(),
            department: String(fields.department || '').trim(),
          });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: friendly(e) };
        }
      },

      async deleteMember(memberId) {
        try {
          const batch = writeBatch(db);
          batch.delete(doc(db, 'members', memberId));
          for (let s = 1; s <= SESSION_COUNT; s++) batch.delete(doc(db, 'attendance', attId(memberId, s)));
          await batch.commit();
          return { ok: true };
        } catch (e) {
          return { ok: false, error: friendly(e) };
        }
      },

      async importMembers(rows) {
        if (!navigator.onLine) return { added: 0, skipped: 0, error: offlineMsg };
        const existingIds = new Set(cur().members.map((m) => m.memberId));
        const keys = new Set(cur().members.map(dupKey));
        const fresh = [];
        let skipped = 0;
        rows.forEach((r) => {
          const key = dupKey({ name: r.name, email: r.email || '', phone: r.phone || '' });
          if (keys.has(key) || (r.memberId && existingIds.has(r.memberId))) { skipped++; return; }
          keys.add(key);
          if (r.memberId) existingIds.add(r.memberId);
          fresh.push(r);
        });
        let added = 0;
        try {
          for (let i = 0; i < fresh.length; i += 400) {
            const chunk = fresh.slice(i, i + 400);
            const count = await runTransaction(db, async (tx) => {
              const cs = await tx.get(counterRef());
              let n = Math.max(readSeq(cs), maxIdNumber(cur().members));
              chunk.forEach((r) => { if (r.memberId) n = Math.max(n, maxIdNumber([{ memberId: r.memberId }])); });
              chunk.forEach((r) => {
                let memberId = r.memberId;
                if (!memberId) { n += 1; memberId = formatMemberId(n); }
                tx.set(doc(db, 'members', memberId), {
                  memberId, name: r.name, role: ROLES.includes(r.role) ? r.role : 'Participant',
                  email: r.email || '', phone: r.phone || '', department: r.department || '',
                  createdAt: new Date().toISOString(),
                });
              });
              tx.set(counterRef(), { memberSeq: n }, { merge: true });
              return chunk.length;
            });
            added += count;
          }
          return { added, skipped };
        } catch (e) {
          return { added, skipped, error: friendly(e) };
        }
      },

      /**
       * Marks attendance instantly (works offline too). The server rule allows only ONE
       * record per member per session, so a second phone cannot create a duplicate.
       */
      markAttendance(memberId, session, method = 'manual') {
        const member = cur().members.find((m) => m.memberId.toLowerCase() === String(memberId).toLowerCase());
        if (!member) return { status: 'notfound' };
        const existing = cur().attendance.find((a) => a.memberId === member.memberId && a.session === session);
        if (existing) return { status: 'duplicate', member, record: existing };
        const record = { memberId: member.memberId, session, timestamp: new Date().toISOString(), method };
        ref.current = { ...cur(), attendance: [...cur().attendance, record] };
        setData(ref.current);
        setDoc(doc(db, 'attendance', attId(member.memberId, session)), record).catch((e) => {
          if (e && e.code === 'permission-denied') notify(`${member.name} was already marked in Session ${session} on another device.`, 'warning');
          else notify(friendly(e), 'danger');
        });
        return { status: 'ok', member, record };
      },

      async removeAttendance(memberId, session) {
        try { await deleteDoc(doc(db, 'attendance', attId(memberId, session))); } catch (e) { notify(friendly(e), 'danger'); }
      },

      async renameSession(id, name) {
        const nm = String(name || '').trim() || `Session ${id}`;
        try { await setDoc(doc(db, 'meta', 'sessions'), { names: { [id]: nm } }, { merge: true }); } catch (e) { notify(friendly(e), 'danger'); }
      },

      getBackup() {
        const d = cur();
        return { app: APP_ID, version: 2, exportedAt: new Date().toISOString(), ...d };
      },

      /** mode: 'replace' | 'merge' */
      async restore(obj, mode) {
        if (!navigator.onLine) throw new Error('You are offline. Restoring needs an internet connection.');
        const incoming = clean(obj);
        const cs = await getDoc(counterRef());
        const seq = Math.max(readSeq(cs), maxIdNumber(cur().members), maxIdNumber(incoming.members));

        if (mode === 'replace') {
          const [ms, as] = await Promise.all([getDocs(collection(db, 'members')), getDocs(collection(db, 'attendance'))]);
          await commitOps([...ms.docs, ...as.docs].map((d) => ({ type: 'delete', ref: d.ref })));
          await commitOps([
            ...incoming.members.map((m) => ({ type: 'set', ref: doc(db, 'members', m.memberId), data: m })),
            ...incoming.attendance.map((a) => ({ type: 'set', ref: doc(db, 'attendance', attId(a.memberId, a.session)), data: a })),
          ]);
          const names = {};
          incoming.sessions.forEach((s) => { names[s.id] = s.name; });
          await setDoc(doc(db, 'meta', 'sessions'), { names });
          await setDoc(counterRef(), { memberSeq: seq }, { merge: true });
          return { members: incoming.members.length, attendance: incoming.attendance.length };
        }

        const have = new Set(cur().members.map((m) => m.memberId));
        const newMembers = incoming.members.filter((m) => !have.has(m.memberId));
        const haveAtt = new Set(cur().attendance.map((a) => attId(a.memberId, a.session)));
        const newAtt = incoming.attendance.filter((a) => !haveAtt.has(attId(a.memberId, a.session)));
        await commitOps([
          ...newMembers.map((m) => ({ type: 'set', ref: doc(db, 'members', m.memberId), data: m })),
          ...newAtt.map((a) => ({ type: 'set', ref: doc(db, 'attendance', attId(a.memberId, a.session)), data: a })),
        ]);
        await setDoc(counterRef(), { memberSeq: seq }, { merge: true });
        return { members: newMembers.length, attendance: newAtt.length };
      },

      async resetAll() {
        if (!navigator.onLine) throw new Error('You are offline. Erasing needs an internet connection.');
        const [ms, as] = await Promise.all([getDocs(collection(db, 'members')), getDocs(collection(db, 'attendance'))]);
        await commitOps([
          ...[...ms.docs, ...as.docs].map((d) => ({ type: 'delete', ref: d.ref })),
          { type: 'delete', ref: counterRef() },
          { type: 'delete', ref: doc(db, 'meta', 'sessions') },
        ]);
      },
    };
  }, [notify]);

  const status = !online ? 'offline' : pending ? 'syncing' : 'live';
  const value = useMemo(() => ({ data, actions, notify, status }), [data, actions, notify, status]);
  const allReady = ready.members && ready.attendance && ready.sessions;

  let body;
  if (fatal) {
    body = (
      <div className="login-wrap">
        <div className="login-card">
          <h1>Cannot load data</h1>
          <p className="text-muted">{fatal}</p>
          <button className="btn btn-teal me-2" onClick={() => window.location.reload()}>Try again</button>
          <button className="btn btn-outline-navy" onClick={logout}>Sign out</button>
        </div>
      </div>
    );
  } else if (!allReady) body = <Splash message="Loading attendance data…" />;
  else body = children;

  return (
    <Ctx.Provider value={value}>
      {body}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`app-toast ${t.type}`}>
            <i className={`bi ${t.type === 'danger' ? 'bi-exclamation-octagon-fill' : t.type === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'}`} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function isValidBackup(obj) {
  return !!obj && typeof obj === 'object' && Array.isArray(obj.members) && Array.isArray(obj.attendance);
}
