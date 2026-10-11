export default function SetupNeeded() {
  return (
    <div className="login-wrap">
      <div className="login-card text-start">
        <h1 className="text-center">Firebase is not set up yet</h1>
        <p className="text-muted">This app needs your Firebase project settings. Do this once:</p>
        <ol className="small">
          <li>Copy <code>.env.example</code> to a new file named <code>.env</code> in the project folder.</li>
          <li>Fill in the Firebase values (see README, step 5).</li>
          <li>Stop and restart <code>npm run dev</code>.</li>
        </ol>
        <p className="small mb-0">On Vercel, add the same <code>VITE_FIREBASE_…</code> variables under Project Settings, Environment Variables, then redeploy.</p>
      </div>
    </div>
  );
}
