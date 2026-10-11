import { useAuth } from '../auth.jsx';
import { DataProvider } from '../store.jsx';
import App from '../App.jsx';
import Login from './Login.jsx';
import SetupNeeded from './SetupNeeded.jsx';
import Splash from './Splash.jsx';

export default function Gate() {
  const { user, configured } = useAuth();
  if (!configured) return <SetupNeeded />;
  if (user === undefined) return <Splash message="Checking sign-in…" />;
  if (!user) return <Login />;
  return (
    <DataProvider>
      <App />
    </DataProvider>
  );
}
