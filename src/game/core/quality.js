// 品質ティア（低/中/高）とFPSオートスケーラ
import { TIERS } from '../config.js';

export function createQuality(G) {
  const order = ['low', 'mid', 'high'];
  const forced = new URLSearchParams(location.search).get('q'); // low|mid|high 固定
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || /Mobile|Android|iPhone|iPad/.test(navigator.userAgent);

  let tierName = forced && TIERS[forced] ? forced : (isTouch || weak ? 'low' : 'mid');

  const listeners = [];
  let fpsAcc = 0, fpsN = 0, lowT = 0, highT = 0, cooldown = 0;

  const Q = {
    get tier() { return TIERS[tierName]; },
    get name() { return tierName; },
    isTouch,
    onChange(fn) { listeners.push(fn); },

    setTier(name) {
      if (!TIERS[name] || name === tierName) return;
      tierName = name;
      const t = TIERS[name];
      G.renderer.setPixelRatio(Math.min(devicePixelRatio, t.pixelRatio));
      G.renderer.setSize(innerWidth, innerHeight);
      if (G.scene.fog) G.scene.fog.density = t.fogDensity;
      if (G.sky) { G.sky.setShadowSize(t.shadowSize); }
      for (const fn of listeners) fn(t, name);
    },

    update(dt) {
      if (forced) return;
      fpsAcc += dt; fpsN++;
      if (cooldown > 0) cooldown -= dt;
      if (fpsAcc < 1) return;
      const fps = fpsN / fpsAcc;
      fpsAcc = 0; fpsN = 0;
      if (fps < 45) { lowT += 1; highT = 0; } else if (fps > 57) { highT += 1; lowT = 0; } else { lowT = highT = 0; }
      const i = order.indexOf(tierName);
      if (lowT >= 5 && i > 0) { Q.setTier(order[i - 1]); lowT = 0; cooldown = 60; }
      else if (highT >= 20 && i < 2 && cooldown <= 0) { Q.setTier(order[i + 1]); highT = 0; }
    },
  };
  return Q;
}
