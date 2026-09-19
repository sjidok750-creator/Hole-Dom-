/* ===== 공용 유틸리티 ===== */
(function () {
  const U = {};
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(U.rand(a, b + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.chance = (p) => Math.random() < p;
  U.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  U.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  U.nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

  /* 칩 표기: 1.2M / 45.3K / 1,234 */
  U.fmt = (n) => {
    n = Math.round(n || 0);
    const abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
    if (abs >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (abs >= 1e4) return (n / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'K';
    return n.toLocaleString('ko-KR');
  };
  U.fmtFull = (n) => Math.round(n || 0).toLocaleString('ko-KR');

  /* 날짜 키(로컬 기준) */
  U.todayKey = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  /* 시드 난수 (미션 로테이션용) */
  U.seeded = (seedStr) => {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return function () {
      h += 0x6d2b79f5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* DOM 헬퍼 */
  U.qs = (sel, root) => (root || document).querySelector(sel);
  U.qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  U.el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  U.on = (el, ev, fn, opts) => el.addEventListener(ev, fn, opts);
  U.rectCenter = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  };

  /* 이벤트 버스 */
  U.Emitter = class {
    constructor() { this.map = new Map(); }
    on(type, fn) {
      if (!this.map.has(type)) this.map.set(type, []);
      this.map.get(type).push(fn);
      return () => this.off(type, fn);
    }
    off(type, fn) {
      const l = this.map.get(type);
      if (l) this.map.set(type, l.filter((f) => f !== fn));
    }
    emit(type, data) {
      (this.map.get(type) || []).forEach((f) => { try { f(data); } catch (e) { console.error(e); } });
      (this.map.get('*') || []).forEach((f) => { try { f(type, data); } catch (e) { console.error(e); } });
    }
  };

  if (typeof window !== 'undefined') window.U = U;
  if (typeof module !== 'undefined') module.exports = U;
})();
