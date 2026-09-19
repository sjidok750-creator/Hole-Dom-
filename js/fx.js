/* ===== 파티클 / 플로팅 텍스트 이펙트 (Canvas) ===== */
(function () {
  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d', { alpha: true });
  let particles = [];
  let running = false;
  let W = 0, H = 0, dpr = 1;

  function resize() {
    dpr = (window.Perf && Perf.dpr) || 1;
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();
  if (window.Perf) Perf.onChange(resize);

  let lastT = 0;
  function loop(t) {
    if (!running) return;
    if (document.hidden) { requestAnimationFrame(loop); return; }
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    ctx.clearRect(0, 0, W, H);
    const alive = [];
    for (const p of particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - p.drag * dt;
      p.rot += p.vr * dt;
      const a = Math.min(1, p.life / p.fade);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      } else if (p.shape === 'spark') {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = a * 0.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2 * a, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2);
        ctx.restore();
      }
      alive.push(p);
    }
    particles = alive;
    ctx.globalAlpha = 1;
    if (particles.length) requestAnimationFrame(loop);
    else { running = false; ctx.clearRect(0, 0, W, H); }
  }
  function start() { if (!running) { running = true; lastT = performance.now(); requestAnimationFrame(loop); } }

  const PALETTE = ['#ff3cac', '#22e6ff', '#ffd166', '#3dff9a', '#b46bff', '#ff8a3c', '#ffffff'];

  const FX = {
    /* 폭죽/컨페티 */
    burst(x, y, opts) {
      opts = opts || {};
      const scale = (window.Perf ? Perf.particleScale() : 1);
      const n = Math.round((opts.count || 60) * scale);
      if (n <= 0) return;
      const colors = opts.colors || PALETTE;
      const spread = opts.spread || Math.PI * 2;
      const dir = opts.dir == null ? -Math.PI / 2 : opts.dir;
      for (let i = 0; i < n; i++) {
        const ang = dir + (Math.random() - 0.5) * spread;
        const sp = (opts.speed || 420) * (0.4 + Math.random() * 0.9);
        particles.push({
          x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          g: opts.gravity == null ? 900 : opts.gravity, drag: 1.2,
          size: (opts.size || 5) * (0.6 + Math.random() * 0.8),
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12,
          life: (opts.life || 1.4) * (0.6 + Math.random() * 0.6), fade: 0.4,
          color: colors[(Math.random() * colors.length) | 0],
          shape: opts.shape || (Math.random() < 0.5 ? 'rect' : 'circle'),
        });
      }
      start();
    },
    sparkle(x, y, count, color) {
      this.burst(x, y, { count: count || 18, speed: 160, gravity: 60, size: 3, life: 0.7, shape: 'spark', colors: color ? [color] : ['#ffffff', '#ffd166', '#22e6ff'] });
    },
    goldRain(count) {
      const scale = (window.Perf ? Perf.particleScale() : 1);
      const n = Math.round((count || 120) * scale);
      for (let i = 0; i < n; i++) {
        particles.push({
          x: Math.random() * W, y: -20 - Math.random() * H * 0.5, vx: (Math.random() - 0.5) * 60, vy: 100 + Math.random() * 200,
          g: 300, drag: 0.2, size: 4 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10,
          life: 2.5 + Math.random() * 1.5, fade: 0.5, color: PALETTE[(Math.random() * PALETTE.length) | 0], shape: 'rect',
        });
      }
      start();
    },
    /* 플로팅 텍스트 */
    floatText(x, y, text, cls) {
      const el = document.createElement('div');
      el.className = 'float-text ' + (cls || '');
      el.textContent = text;
      el.style.left = x + 'px'; el.style.top = y + 'px';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1500);
    },
    shake(ms) {
      if (window.Perf && Perf.reducedMotion) return;
      document.body.classList.add('shake');
      setTimeout(() => document.body.classList.remove('shake'), ms || 350);
    },
    flash(color) {
      const el = document.createElement('div');
      el.className = 'screen-flash';
      if (color) el.style.background = color;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 500);
    },
  };
  window.FX = FX;
})();
