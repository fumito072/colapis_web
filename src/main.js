/**
 * COLAPIS Homepage — Main Entry Point
 * Wires together Scene, Router, and HandTracker
 */
import './style.css';
import { SceneManager } from './canvas/SceneManager.js';
import { Router } from './router.js';
import { HandTracker } from './tracking/HandTracker.js';
import { createCompanyPage } from './pages/CompanyPage.js';
import { createServicesPage } from './pages/ServicesPage.js';
import { createWorksPage } from './pages/WorksPage.js';

// ---- DOM References ----
const canvas = document.getElementById('main-canvas');
const titleOverlay = document.getElementById('title-overlay');
const pageContainer = document.getElementById('page-container');

// ---- Router Setup ----
const router = new Router();

router
  .add('#/', null) // Top page — handled by canvas scene
  .add('#/company', createCompanyPage)
  .add('#/services', createServicesPage)
  .add('#/works', createWorksPage);

router.onRouteChange = (route, prevRoute) => {
  if (router.isTopPage()) {
    // Show canvas, hide page
    showTopPage();
  } else {
    const handler = router.getHandler();
    if (handler) {
      showPage(handler);
    }
  }
};

// ---- Scene Setup ----
const scene = new SceneManager(canvas, (stone) => {
  // Stone clicked — navigate to its route
  router.navigate(stone.route);
});

// ---- Hand Tracker Setup ----
const handTracker = new HandTracker();
handTracker.onCursorUpdate = (cursor) => {
  scene.setHandCursor(cursor);
};

// ---- Page Navigation ----

function showTopPage() {
  // Fade out page container
  pageContainer.classList.remove('visible');
  pageContainer.classList.add('hidden');

  // Show canvas & title
  canvas.style.display = 'block';
  titleOverlay.classList.remove('hidden');

  // Clean up page content after animation
  setTimeout(() => {
    pageContainer.innerHTML = '';
  }, 600);
}

function showPage(pageFactory) {
  // Create page content
  const content = pageFactory();

  // Add back button
  const backBtn = document.createElement('button');
  backBtn.className = 'back-btn';
  backBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
    <span>戻る</span>
  `;
  backBtn.addEventListener('click', () => router.goHome());

  // Hide canvas & title
  titleOverlay.classList.add('hidden');

  // Show page container
  pageContainer.innerHTML = '';
  pageContainer.appendChild(backBtn);
  pageContainer.appendChild(content);
  pageContainer.classList.remove('hidden');
  pageContainer.classList.add('visible');
}

// ---- Initialize ----
router.init();

// If no hash, default to top
if (!window.location.hash || window.location.hash === '#') {
  window.location.hash = '#/';
}
