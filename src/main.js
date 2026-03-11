/**
 * COLAPIS Homepage — Main Entry Point
 *
 * Seamless transition architecture:
 * - World 1 owns the single WebGLRenderer, Scene, Camera, EffectComposer
 * - World 2 adds its objects to the shared scene at z=-15
 * - Camera flies from z=5.5 (World 1) to z=-10 (World 2) during transition
 * - Dissolve particles stream forward (-z), bridging both worlds
 * - Background particles span the full depth range
 * - No canvas hide/show — one continuous rendering pipeline
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

// ---- World 1 Scene (Three.js — owns the renderer) ----
const scene = new SceneManager3DWorld1(canvas, async (stone) => {
  // Dissolve phase completed → set up World 2 in the shared scene
  await setupWorld2(stone.id);
});

// ---- Hand Tracker ----
const handTracker = new HandTracker();
handTracker.onCursorUpdate = (cursor) => {
  scene.setHandCursor(cursor);
};

// ---- World Transition ----

/**
 * Set up World 2 in the shared scene. Called during the camera flight
 * (Phase 5 of dissolve), so World 2 objects appear as camera approaches.
 */
async function setupWorld2(stoneId) {
  if (currentWorld === 'world2') return;
  currentWorld = 'world2';

  // Hide World 1 UI elements
  titleOverlay.classList.add('hidden');
  handTrackingBtn.style.opacity = '0';
  handTrackingBtn.style.pointerEvents = 'none';

  // Lazy-load World 2 scene
  if (!world2Scene) {
    const { SceneManager3D } = await import('./world2/SceneManager3D.js');
    const ctx = scene.getSceneContext();
    world2Scene = new SceneManager3D(world2Container, ctx, exitWorld2);
  }

  // Register with World 1's animation loop
  scene.setWorld2Manager(world2Scene);

  // Enter World 2 (adds objects to shared scene)
  world2Scene.enter(stoneId);
}

/**
 * Return from World 2 to World 1. Camera flies back, World 2 fades out.
 */
function exitWorld2() {
  if (currentWorld === 'world1') return;
  currentWorld = 'world1';

  // Exit World 2 (collapse fragments, fade lights)
  if (world2Scene) {
    world2Scene.exit();
  }

  // Animate camera back to World 1 position
  scene.returnFromWorld2();

  // Re-show World 1 UI after camera returns
  setTimeout(() => {
    titleOverlay.classList.remove('hidden');
    stoneLabels.style.opacity = '1';
    handTrackingBtn.style.opacity = '1';
    handTrackingBtn.style.pointerEvents = 'auto';
  }, 2800);
}


// ---- Initialize ----
canvas.style.display = 'block';
canvas.style.opacity = '1';
