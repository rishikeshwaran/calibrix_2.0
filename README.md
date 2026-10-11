# CALIBRIX 2K26 · Digital Attendance (shared, multi-phone)

React + Vite + Bootstrap 5 attendance app with QR codes for 12 sessions.
All phones share **one live database (Firebase Firestore)**, protected by an **event passcode**.

- Scan on any phone: every other phone sees it within a second.
- A member can only be marked once per session, even if two phones scan at the same moment
  (the database rules enforce it).
- Short Wi-Fi drops are fine: scans are kept on the phone and sync when it is back online.
- Export / restore everything as JSON, and export reports to Excel or CSV.

---

## 1. One-time Firebase setup (about 10 minutes, free plan is enough)

1. Go to https://console.firebase.google.com → **Add project** → name it (for example `calibrix-2k26`).
   You can turn Google Analytics off.
2. **Build → Firestore Database → Create database.**
   Choose **Production mode** and a nearby location (for India, `asia-south1 (Mumbai)`).
3. In Firestore, open the **Rules** tab. Delete what is there, paste the full contents of
   `firestore.rules` from this project, and click **Publish**.
4. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save.**
   Then open the **Users** tab → **Add user**:
   - Email: `volunteer@calibrix2k26.app`
   - Password: your **event passcode** (at least 6 characters). Volunteers type only this passcode.
5. Click the gear icon → **Project settings → General → Your apps → Web (`</>`)**.
   Register an app (skip Hosting). Firebase shows a `firebaseConfig` block.
   Copy these values into the next step.

## 2. Run it on your computer

You need Node.js 18 or newer.

```bash
cd calibrix-2k26
cp .env.example .env        # on Windows: copy .env.example .env
```

Open `.env` and fill in the values from step 5:

| .env name | firebaseConfig field |
|---|---|
| VITE_FIREBASE_API_KEY | apiKey |
| VITE_FIREBASE_AUTH_DOMAIN | authDomain |
| VITE_FIREBASE_PROJECT_ID | projectId |
| VITE_FIREBASE_APP_ID | appId |
| VITE_FIREBASE_MESSAGING_SENDER_ID | messagingSenderId |
| VITE_FIREBASE_STORAGE_BUCKET | storageBucket |

```bash
npm install
npm run dev
```

Open http://localhost:5173 and sign in with the event passcode.

## 3. Deploy on Vercel

1. Push the folder to GitHub (`.env` is git-ignored, so your file is not uploaded).
2. On vercel.com: **Add New → Project → import the repo**. Vercel detects Vite
   (build `npm run build`, output `dist`).
3. Before deploying, open **Environment Variables** and add the same `VITE_FIREBASE_…`
   names and values from your `.env` (and `VITE_ACCESS_EMAIL` only if you changed the email).
4. Deploy. If you add or change variables later, **redeploy** so the build picks them up.

Vercel gives you HTTPS, so the phone camera scanner works. Share the Vercel link and the
passcode with your volunteers.

Firebase web config values are not secrets. Security comes from the passcode login and the
Firestore rules. Do not skip step 3 or 4 of the Firebase setup.

## 4. How to use

1. **Members**: add participants and office bearers, or *Import CSV*
   (`name, role, email, phone, department`; template available in the app).
   Member IDs (`CLX-0001`, …) are handed out by the database, so two phones never get the same ID.
2. **QR codes**: print the sheet or download single PNG badges. One QR per member for all 12 sessions.
3. **Attendance**: pick a session and scan or search. Open it on as many phones as you like.
4. **Reports**: overall and per-session views; export Excel / CSV, or a workbook of all 12 sessions.
5. **Backup**: download a JSON backup after each session. Restore with *Merge* (adds missing data)
   or *Replace* (overwrites everything). Old LocalStorage-version backups can be restored too.

## Good to know

- **Everyone with the passcode has full access**, including delete and erase. Share it only with
  trusted volunteers, and change it in Firebase Authentication → Users if it leaks.
- **Adding members and importing need internet.** Marking attendance also works offline and syncs later.
  If two phones mark the same person while offline, the first to sync wins and the other phone is told.
- **Free plan limits**: Firestore's free tier has daily read/write quotas (check Firebase's current
  pricing page). A typical event of a few hundred members and a handful of phones fits comfortably.
- **Camera** needs `https://` or `localhost`. If it is blocked, use the search box (a USB barcode
  scanner also works there).
- Marked times come from each phone's clock, so keep phone time set to automatic.
