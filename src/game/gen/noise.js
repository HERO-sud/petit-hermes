// seed付きPRNGとfbm/ridgedノイズ
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

let _seed = 1402.5;
export function seed(s) { _seed = s; }
export function rand() { _seed = (_seed * 16807) % 2147483647; return _seed / 2147483647; }
export function randR(a, b) { return a + rand() * (b - a); }

const perlin = new ImprovedNoise();
export function noise2(x, y) { return perlin.noise(x, y, 0.37); } // -1..1 近似

export function fbm(x, y, octaves = 4, lacunarity = 2.1, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq, y * freq);
    norm += amp;
    amp *= gain; freq *= lacunarity;
  }
  return sum / norm;
}

export function ridged(x, y, octaves = 4) {
  let amp = 0.5, freq = 1, sum = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * (1 - Math.abs(noise2(x * freq, y * freq)));
    amp *= 0.5; freq *= 2.15;
  }
  return sum; // 0..~1
}

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));
export function dampAngle(cur, target, lambda, dt) {
  let d = (target - cur) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return cur + d * (1 - Math.exp(-lambda * dt));
}
