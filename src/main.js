/**
 * COLAPIS Homepage — Main Entry Point
 * Manages World 1 (Three.js 3D stones) and World 2 (Three.js 3D detail) scenes.
 */
import './style.css';
import { SceneManager3DWorld1 } from './world1/SceneManager3DWorld1.js';
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

// ---- World 1 Scene (Three.js) ----
const scene = new SceneManager3DWorld1(canvas, (stone) => {
  // Stone dissolve completed in World 1 → transition to World 2
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

  // Fade out World 1 overlay elements
  titleOverlay.classList.add('hidden');
  handTrackingBtn.style.opacity = '0';
  handTrackingBtn.style.pointerEvents = 'none';

  // Fade out canvas (the dissolve animation already took care of the visual)
  canvas.style.transition = 'opacity 0.8s ease';
  canvas.style.opacity = '0';

  // Wait for fade
  await delay(900);

  // Hide World 1
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

    // Fade in
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
    scene.restart();
  }, 900);
}

// ---- Utility ----
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---- Initialize ----
canvas.style.display = 'block';
canvas.style.opacity = '1';
