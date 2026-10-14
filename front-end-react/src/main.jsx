// main.jsx is the first file that runs - it starts React.

import React from 'react';                                   // React itself
import { createRoot } from 'react-dom/client';               // React 18 way to boot the app
import App from './App.jsx';                                 // Our top-level component (router lives here)
import './index.css';                                        // Global CSS (Tailwind + small extras)

// Find the empty <div id="root"> in index.html and draw the whole app inside it.
// <StrictMode> is a React helper that catches common mistakes during development.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
