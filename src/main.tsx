import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inclusive-sans/400.css';
import '@fontsource/inclusive-sans/700.css';
import '@fontsource/opendyslexic/400.css';
import '@fontsource/opendyslexic/700.css';
import '@fontsource/playwrite-us-trad/400.css';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
