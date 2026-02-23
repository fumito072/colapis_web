/**
 * COLAPIS Homepage — Main Entry Point
 * Manages World 1 (Canvas 2D) and World 2 (Three.js 3D) scenes.
 */
import './style.css';
import { SceneManager } from './canvas/SceneManager.js';
import { HandTracker } from './tracking/HandTracker.js';

// ---- DOM References ----
const canvas = document.getElementById('main-canvas');
const titleOverlay = document.getElementById('title-overlay');
const stoneLabels = document.getElementById('stone-labels');
const world2Container = document.getElementById('world2-container');
const handTrackingBtn = document.getElementById('hand-tracking-btn');

// ---- State ----
let currentWorld = 'world1'; // 'world1' | 'world2'
let world2Scene = null;

// ---- World 1 Scene ----
const scene = new SceneManager(canvas, (stone) => {
  // Stone clicked in World 1 → transition to World 2
  enterWorld2(stone.id);
});

// ---- Hand Tracker ----
const handTracker = new HandTracker();
handTracker.onCursorUpdate = (cursor) => {
  scene.setHandCursor(cursor);
};

// ---- World Transition ----

async function enterWorld2(stoneId) {
  if (currentWorld === 'world2') return;
  currentWorld = 'world2';

  // Fade out World 1 elements
  titleOverlay.classList.add('hidden');
  stoneLabels.style.opacity = '0';
  stoneLabels.style.transition = 'opacity 0.5s ease';
  handTrackingBtn.style.opacity = '0';
  handTrackingBtn.style.pointerEvents = 'none';

  // Fade out canvas
  canvas.style.transition = 'opacity 0.6s ease';
  canvas.style.opacity = '0';

  // Wait for fade
  await delay(600);

  // Hide World 1 elements
  canvas.style.display = 'none';
  scene.destroy();

  // Lazy-load World 2 scene
  if (!world2Scene) {
    const { SceneManager3D } = await import('./world2/SceneManager3D.js');
    world2Scene = new SceneManager3D(world2Container, exitWorld2);
  }

  // Enter World 2 with selected stone
  world2Scene.enter(stoneId);
}

function exitWorld2() {
  if (currentWorld === 'world1') return;
  currentWorld = 'world1';

  // Exit World 2 scene
  if (world2Scene) {
    world2Scene.exit();
  }

  // Re-show World 1 after a brief delay
  setTimeout(() => {
    // Show canvas
    canvas.style.display = 'block';

    // Reinitialize World 1 scene by forcing a resize
    canvas.style.opacity = '0';
    requestAnimationFrame(() => {
      canvas.style.transition = 'opacity 0.8s ease';
      canvas.style.opacity = '1';
    });

    // Show title and controls
    titleOverlay.classList.remove('hidden');
    stoneLabels.style.opacity = '1';
    handTrackingBtn.style.opacity = '1';
    handTrackingBtn.style.pointerEvents = 'auto';

    // Restart World 1 scene
    scene.running = true;
    scene._resize();
    scene._animate();
  }, 900);
}

// ---- Utility ----
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---- Initialize ----
// Default to World 1 (top page)
canvas.style.display = 'block';
canvas.style.opacity = '1';
