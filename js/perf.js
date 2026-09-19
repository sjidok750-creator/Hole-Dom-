/* ===== 기기 성능 감지 / 품질 티어 ===== */
(function () {
  const Perf = {
    tier: 'high', // high | medium | low
    manual: 'auto',
    dpr: 1,
    reducedMotion: false,
    hidden: false,
    listeners: [],

    detect() {
      const nav = navigator;
      const cores = nav.hardwareConcurrency || 4;
      const mem = nav.deviceMemory || 4;
      const w = Math.max(screen.width, screen.height);
      const dpr = window.devicePixelRatio || 1;
      this.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let score = 0;
      score += cores >= 8 ? 3 : cores >= 4 ? 2 : cores >= 2 ? 1 : 0;
      score += mem >= 8 ? 3 : mem >= 4 ? 2 : mem >= 2 ? 1 : 0;
      score += w * dpr >= 2000 ? 1 : 0;
      const conn = nav.connection && nav.connection.saveData;
      if (conn) score -= 1;
      const ua = nav.userAgent || '';
      if (/Android [4-7]\./.test(ua)) score -= 2;
      this.auto = score >= 5 ? 'high' : score >= 3 ? 'medium' : 'low';
      this.apply();
      return this.auto;
    },

    /* 첫 프레임들 실측 → 느리면 강등 */
    benchmark() {
      if (this.manual !== 'auto') return;
      let frames = 0, start = 0, worst = 0, last = 0;
      const step = (t) => {
        if (!start) { start = t; last = t; }
        else { worst = Math.max(worst, t - last); last = t; }
        frames++;
        if (frames < 40) requestAnimationFrame(step);
        else {
          const avg = (t - start) / (frames - 1);
          if (avg > 28 || worst > 120) { this.auto = this.auto === 'high' ? 'medium' : 'low'; this.apply(); }
        }
      };
      requestAnimationFrame(step);
    },

    setManual(q) { this.manual = q; this.apply(); },

    apply() {
      const t = this.manual === 'auto' ? this.auto : this.manual;
      this.tier = t;
      this.dpr = Math.min(window.devicePixelRatio || 1, t === 'high' ? 2 : t === 'medium' ? 1.5 : 1);
      document.documentElement.dataset.quality = t;
      document.documentElement.dataset.motion = this.reducedMotion ? 'reduced' : 'full';
      this.listeners.forEach((f) => f(t));
      if (typeof AI !== 'undefined') AI.setQuality(t);
    },
    onChange(f) { this.listeners.push(f); },
    particleScale() { return this.tier === 'high' ? 1 : this.tier === 'medium' ? 0.5 : 0.2; },
  };
  document.addEventListener('visibilitychange', () => { Perf.hidden = document.hidden; });
  window.Perf = Perf;
})();
