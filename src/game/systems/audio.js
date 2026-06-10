// WebAudioプロシージャル: 環境音（風・鳥・川）+ SFX
export function createAudio(G) {
  let AC = null;
  let wind = null, riverGain = null;

  function init() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    AC = new (window.AudioContext || window.webkitAudioContext)();

    // ---- 風: ピンクノイズ → ローパス、LFOでうねり ----
    const len = AC.sampleRate * 4;
    const buf = AC.createBuffer(1, len, AC.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + 0.029591 * w;
      b1 = 0.985 * b1 + 0.032534 * w;
      b2 = 0.95 * b2 + 0.048056 * w;
      d[i] = (b0 + b1 + b2) * 0.6;
    }
    const noise = AC.createBufferSource();
    noise.buffer = buf; noise.loop = true;
    const lp = AC.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.4;
    wind = AC.createGain(); wind.gain.value = 0.05;
    const lfo = AC.createOscillator(); lfo.frequency.value = 0.13;
    const lfoG = AC.createGain(); lfoG.gain.value = 0.025;
    lfo.connect(lfoG).connect(wind.gain);
    noise.connect(lp).connect(wind).connect(AC.destination);
    noise.start(); lfo.start();

    // ---- 川: ホワイトノイズ → バンドパス、距離でゲイン ----
    const wbuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    const wd = wbuf.getChannelData(0);
    for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
    const wsrc = AC.createBufferSource();
    wsrc.buffer = wbuf; wsrc.loop = true;
    const bp = AC.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 0.7;
    riverGain = AC.createGain(); riverGain.gain.value = 0;
    wsrc.connect(bp).connect(riverGain).connect(AC.destination);
    wsrc.start();

    // ---- 鳥: ランダムチャープ ----
    function birdLoop() {
      if (!AC) return;
      const delay = 2.5 + Math.random() * 6;
      setTimeout(() => {
        if (G.state.phase === 'PLAY' || G.state.phase === 'PHOTO') {
          const n = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) {
            const f = 2200 + Math.random() * 1600;
            chirp(f, 0.07 + Math.random() * 0.05, i * 0.13, 0.025);
          }
        }
        birdLoop();
      }, delay * 1000);
    }
    birdLoop();
  }

  function tone(freq, dur, type = 'sine', delay = 0, vol = 0.14) {
    if (!AC) return;
    const t0 = AC.currentTime + delay;
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(AC.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function chirp(freq, dur, delay = 0, vol = 0.03) {
    if (!AC) return;
    const t0 = AC.currentTime + delay;
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t0);
    o.frequency.exponentialRampToValueAtTime(freq * 1.4, t0 + dur * 0.6);
    o.frequency.exponentialRampToValueAtTime(freq * 0.9, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(AC.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noiseBurst(dur, freq, vol) {
    if (!AC) return;
    const t0 = AC.currentTime;
    const src = AC.createBufferSource();
    const buf = AC.createBuffer(1, AC.sampleRate * dur, AC.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    src.buffer = buf;
    const f = AC.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
    const g = AC.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(AC.destination);
    src.start(t0);
  }

  return {
    init,
    sfx: {
      step(onRoad) { noiseBurst(0.09, onRoad ? 900 : 420, 0.05); },
      jump() { tone(290, 0.09, 'triangle', 0, 0.06); },
      pickup() { tone(523, 0.08, 'triangle'); tone(784, 0.13, 'triangle', 0.08); },
      doorbell() { tone(1318, 0.4, 'sine', 0, 0.1); tone(1046, 0.5, 'sine', 0.18, 0.1); },
      talk() { tone(640, 0.04, 'square', 0, 0.04); },
      objective() { tone(659, 0.1, 'triangle'); tone(988, 0.2, 'triangle', 0.1); },
      paypay() { tone(1568, 0.09, 'sine', 0, 0.18); tone(2093, 0.25, 'sine', 0.09, 0.18); },
      buy() { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.11, 'triangle', i * 0.07)); },
      eat() { tone(392, 0.08); tone(523, 0.12, 'sine', 0.08); },
      camera() { noiseBurst(0.05, 2400, 0.1); tone(1800, 0.05, 'square', 0.02, 0.05); },
      bus() { tone(140, 1.6, 'sawtooth', 0, 0.03); tone(96, 1.6, 'sawtooth', 0, 0.03); },
      end() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', i * 0.1)); },
    },
    update(playerPos) {
      if (!AC || !riverGain) return;
      const d = G.terrain.distRiver(playerPos.x, playerPos.z);
      riverGain.gain.value = Math.max(0, 0.09 * (1 - d / 60));
    },
  };
}
