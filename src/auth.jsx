import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ACCESS_EMAIL, auth, isConfigured } from './firebase.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking

  useEffect(() => {
    if (!auth) { setUser(null); return undefined; }
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  const signIn = useCallback(async (passcode) => {
    try {
      await signInWithEmailAndPassword(auth, ACCESS_EMAIL, passcode);
      return { ok: true };
    } catch (e) {
      const code = e && e.code;
      let error = 'Could not sign in. Try again.';
      if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-login-credentials'].includes(code)) error = 'Incorrect passcode.';
      else if (code === 'auth/too-many-requests') error = 'Too many attempts. Wait a minute and try again.';
      else if (code === 'auth/network-request-failed') error = 'No internet connection.';
      else if (code === 'auth/operation-not-allowed') error = 'Email/Password sign-in is not enabled in Firebase Authentication.';
      else if (code === 'auth/invalid-api-key' || code === 'auth/api-key-not-valid') error = 'The Firebase API key is wrong. Check your environment variables.';
      return { ok: false, error };
    }
  }, []);

  const logout = useCallback(() => (auth ? signOut(auth) : Promise.resolve()), []);

  const value = useMemo(() => ({ user, signIn, logout, configured: isConfigured }), [user, signIn, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
