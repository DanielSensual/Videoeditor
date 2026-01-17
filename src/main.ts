/**
 * AntiGravity - AI-powered video editor
 *
 * Main entry point for the application.
 */

import './ui/styles/index.css';
import './ui/styles/dashboard.css';
import { initDashboard } from './ui/Dashboard';

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('AntiGravity initializing...');

  // Initialize dashboard
  initDashboard('app');

  console.log('AntiGravity ready');
});
