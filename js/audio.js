/* ===== 합성 사운드 (에셋 없음, WebAudio) ===== */
(function () {
  let ctx = null, master = null, enabled = true, unlocked = false;
  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    return ctx;
  }
  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
    unlocked = true;
  }
  ['pointerdown', 'touchstart', 'keydown'].forEach((ev) => document.addEventListener(ev, unlock, { once: false, passive: true }));

  function tone(freq, dur, type, vol, when, opts) {
    const c = ensure(); if (!c || !enabled) return;
    opts = opts || {};
    const t0 = c.currentTime + (when || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(opts.slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + (opts.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, when, filterFreq) {
    const c = ensure(); if (!c || !enabled) return;
    const t0 = c.currentTime + (when || 0);
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filterFreq || 2500; f.Q.value = 0.8;
    const g = c.createGain(); g.gain.setValueAtTime(vol || 0.2, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  const Sfx = {
    setEnabled(v) { enabled = v; },
    get enabled() { return enabled; },
    click() { tone(1200, 0.05, 'square', 0.05); },
    deal() { noise(0.08, 0.18, 0, 3500); tone(2400, 0.04, 'triangle', 0.04); },
    flip() { noise(0.1, 0.15, 0, 1800); },
    chip() { for (let i = 0; i < 3; i++) { tone(3200 + Math.random() * 800, 0.03, 'triangle', 0.08, i * 0.035); noise(0.03, 0.08, i * 0.035, 5000); } },
    chips() { for (let i = 0; i < 6; i++) { tone(2800 + Math.random() * 1200, 0.03, 'triangle', 0.07, i * 0.03); noise(0.03, 0.06, i * 0.03, 5000); } },
    check() { tone(220, 0.06, 'sine', 0.2); tone(180, 0.08, 'sine', 0.15, 0.07); },
    fold() { noise(0.16, 0.12, 0, 900); },
    turn() { tone(880, 0.08, 'sine', 0.12); tone(1320, 0.12, 'sine', 0.1, 0.06); },
    tick() { tone(1500, 0.03, 'square', 0.05); },
    allin() { tone(160, 0.5, 'sawtooth', 0.15, 0, { slide: 80 }); tone(640, 0.12, 'square', 0.06, 0.05); tone(960, 0.12, 'square', 0.06, 0.15); tone(1280, 0.25, 'square', 0.06, 0.25); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.14, i * 0.08)); },
    bigWin() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => { tone(f, 0.35, 'triangle', 0.14, i * 0.09); tone(f / 2, 0.4, 'sine', 0.08, i * 0.09); }); noise(0.5, 0.1, 0.5, 6000); },
    lose() { tone(330, 0.25, 'sine', 0.12); tone(262, 0.35, 'sine', 0.12, 0.2); },
    mission() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, 'square', 0.07, i * 0.07)); },
    levelUp() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.14, i * 0.1)); },
    bust() { tone(200, 0.6, 'sawtooth', 0.12, 0, { slide: 60 }); },
    warn() { tone(700, 0.08, 'square', 0.08); tone(700, 0.08, 'square', 0.08, 0.15); },
  };
  window.Sfx = Sfx;
})();
