import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { isNativeApp } from './services/carMedia';

createRoot(document.getElementById('root')!).render(<App />);

// Register the service worker that backs the installed app. Only in a built
// app: in dev it would cache the bundle and mask edits. The Android app ships
// its files inside the APK, so it has nothing to cache.
if (import.meta.env.PROD && !isNativeApp && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}
