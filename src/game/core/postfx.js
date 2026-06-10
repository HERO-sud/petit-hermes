// ポストプロセス：高/中=Bloom+SMAA（強度差）/ 低=コンポーザ無し
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

export function createPostFX(G) {
  let composer = null;
  let mode = 'none';

  function build(post) {
    mode = post;
    if (composer) { composer.dispose?.(); composer = null; }
    if (post === 'none') return;
    const { renderer, scene, camera } = G;
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight),
      post === 'full' ? 0.22 : 0.15, 0.45, 1.0));
    composer.addPass(new OutputPass());
    composer.addPass(new SMAAPass(innerWidth, innerHeight));
  }

  addEventListener('resize', () => { if (composer) composer.setSize(innerWidth, innerHeight); });

  return {
    get mode() { return mode; },
    get passCount() { return composer ? composer.passes.length : 0; },
    build,
    render() {
      if (composer) composer.render();
      else G.renderer.render(G.scene, G.camera);
    },
  };
}
