/**
 * main.js - Application Entrypoint
 */

import { App } from './app.js';

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init().catch(err => {
    console.error('Fatal initialization error:', err);
  });
});
