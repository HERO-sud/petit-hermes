// アセットローダ（GLB / HDR / 画像テクスチャ）
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const dracoLoader = new DRACOLoader().setDecoderPath('assets/draco/');
const gltfLoader = new GLTFLoader().setDRACOLoader(dracoLoader);
const rgbeLoader = new RGBELoader();
const texLoader = new THREE.TextureLoader();

export function loadGLB(url) {
  return new Promise((resolve, reject) => gltfLoader.load(url, resolve, undefined, reject));
}
export function loadHDR(url) {
  return new Promise((resolve, reject) => rgbeLoader.load(url, resolve, undefined, reject));
}
export function loadTex(url, { srgb = true, repeat = null, aniso = 4 } = {}) {
  return new Promise((resolve, reject) => texLoader.load(url, (t) => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = aniso;
    resolve(t);
  }, undefined, reject));
}
