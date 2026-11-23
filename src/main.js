/**
 * main.js - Application Entrypoint
 */

import { App } from './app.js';

function startApp() {
  const app = new App();
  app.init().catch(err => {
    console.error('Fatal initialization error:', err);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

