import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles.css';
import { AuthProvider } from './auth.jsx';
import Gate from './components/Gate.jsx';

// StrictMode is intentionally not used: it double-mounts effects in dev,
// which conflicts with the camera scanner start/stop lifecycle.
ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <Gate />
  </AuthProvider>
);
