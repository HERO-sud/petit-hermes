import * as THREE from 'three';
import { CFG } from '../config.js';

export function createRenderer(tier) {
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: tier.msaa,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, tier.pixelRatio));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.55;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.3, 1400);
  camera.position.set(CFG.spawn.x, 2, CFG.spawn.z + 6);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // WebGLコンテキスト喪失時の案内（GPUリセット等。復帰イベントでリロード）
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    const el = document.getElementById('ctxlost');
    if (el) el.classList.remove('hidden');
  });
  canvas.addEventListener('webglcontextrestored', () => location.reload());

  return { renderer, scene, camera, canvas };
}
