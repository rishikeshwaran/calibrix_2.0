import * as XLSX from 'xlsx';
import QRCode from 'qrcode';

export const SESSION_COUNT = 12;
export const ROLES = ['Participant', 'Office Bearer'];
export const QR_PREFIX = 'CALIBRIX2K26';

/* ---------- IDs & QR payloads ---------- */
export const qrPayload = (memberId) => `${QR_PREFIX}:${memberId}`;

export function parseQrPayload(text) {
  const t = String(text || '').trim();
  const i = t.indexOf(':');
  if (i > -1 && t.slice(0, i).toUpperCase() === QR_PREFIX) return t.slice(i + 1).trim();
  return t;
}

export function maxIdNumber(members) {
  let max = 0;
  members.forEach((m) => {
    const n = parseInt(String(m.memberId).replace(/\D/g, ''), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  });
  return max;
}
export const formatMemberId = (n) => `CLX-${String(n).padStart(4, '0')}`;

/* ---------- Formatting ---------- */
export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
export const safeName = (s) => String(s || 'file').replace(/[^a-z0-9_\-]+/gi, '_').replace(/^_+|_+$/g, '');
export const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

/* ---------- CSV parsing ---------- */
export function parseCSV(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const HEADER_MAP = {
  name: ['name', 'fullname', 'participantname', 'membername', 'studentname'],
  role: ['role', 'type', 'category', 'membertype', 'designation'],
  email: ['email', 'emailid', 'mail', 'emailaddress'],
  phone: ['phone', 'mobile', 'contact', 'phonenumber', 'mobilenumber', 'contactnumber'],
  department: ['department', 'dept', 'college', 'organization', 'organisation', 'institution', 'year', 'class'],
  memberId: ['memberid', 'id', 'regno', 'registrationno', 'registrationnumber'],
};

export function normalizeRole(v) {
  const s = norm(v);
  if (s.includes('office') || s.includes('bearer') || s === 'ob' || s.includes('organizer') || s.includes('organiser') || s.includes('coordinator')) return 'Office Bearer';
  return 'Participant';
}

export function csvToMembers(text) {
  const rows = parseCSV(text);
  const errors = [];
  if (!rows.length) return { rows: [], errors: ['The file is empty.'] };

  const header = rows[0].map(norm);
  const idx = {};
  Object.entries(HEADER_MAP).forEach(([key, names]) => {
    const i = header.findIndex((h) => names.includes(h));
    if (i > -1) idx[key] = i;
  });

  let body = rows;
  if (idx.name !== undefined) body = rows.slice(1);
  else {
    // No recognisable header: assume column order name, role, email, phone, department
    Object.assign(idx, { name: 0, role: 1, email: 2, phone: 3, department: 4 });
  }

  const out = [];
  body.forEach((r, n) => {
    const get = (k) => (idx[k] !== undefined ? String(r[idx[k]] ?? '').trim() : '');
    const name = get('name');
    const line = n + (idx.name !== undefined && body !== rows ? 2 : 1);
    if (!name) { errors.push(`Row ${line}: name is missing, skipped.`); return; }
    out.push({
      name,
      role: normalizeRole(get('role')),
      email: get('email'),
      phone: get('phone'),
      department: get('department'),
      memberId: get('memberId'),
    });
  });
  return { rows: out, errors };
}

export const CSV_TEMPLATE =
  'name,role,email,phone,department\n' +
  'Asha Kumar,Participant,asha@example.com,9876543210,CSE\n' +
  'Ravi Shankar,Office Bearer,ravi@example.com,9123456780,ECE\n';

/* ---------- Downloads ---------- */
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCSV = (aoa) => aoa.map((r) => r.map(csvCell).join(',')).join('\r\n');

export function downloadCSV(filename, aoa) {
  downloadBlob(filename, new Blob(['\uFEFF' + toCSV(aoa)], { type: 'text/csv;charset=utf-8' }));
}

export function downloadXLSX(filename, sheets) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const widths = rows[0] ? rows[0].map((_, c) => ({ wch: Math.min(34, Math.max(8, ...rows.slice(0, 200).map((r) => String(r[c] ?? '').length)) + 2) })) : [];
    ws['!cols'] = widths;
    XLSX.utils.book_append_sheet(wb, ws, name.replace(/[\\/?*[\]:]/g, '-').slice(0, 31));
  });
  XLSX.writeFile(wb, filename);
}

export function downloadJSON(filename, obj) {
  downloadBlob(filename, new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
}

/* ---------- QR card PNG ---------- */
const loadImage = (src) => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = rej;
  img.src = src;
});

export async function downloadQrPng(member) {
  const url = await QRCode.toDataURL(qrPayload(member.memberId), {
    width: 420, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0a1f44', light: '#ffffff' },
  });
  const img = await loadImage(url);
  const c = document.createElement('canvas');
  c.width = 500; c.height = 640;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#0a1f44'; ctx.fillRect(0, 0, c.width, 70);
  ctx.fillStyle = '#ffffff'; ctx.font = '700 28px Arial, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('CALIBRIX 2K26', c.width / 2, 45);
  ctx.drawImage(img, 40, 90, 420, 420);
  ctx.fillStyle = '#0a1f44'; ctx.font = '700 26px Arial, sans-serif';
  ctx.fillText(member.name.slice(0, 32), c.width / 2, 550);
  ctx.fillStyle = '#0d9488'; ctx.font = '600 22px Arial, sans-serif';
  ctx.fillText(`${member.memberId}  |  ${member.role}`, c.width / 2, 590);
  await new Promise((res) => c.toBlob((b) => { downloadBlob(`${member.memberId}_${safeName(member.name)}.png`, b); res(); }));
}

/* ---------- Feedback beep ---------- */
export function beep(kind) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = kind === 'ok' ? 880 : 260;
    g.gain.value = 0.06;
    o.start();
    o.stop(ctx.currentTime + (kind === 'ok' ? 0.12 : 0.28));
    setTimeout(() => ctx.close(), 500);
  } catch { /* sound is optional */ }
}
