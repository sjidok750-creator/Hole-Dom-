/* ===== 프로필 / 저장 (localStorage) ===== */
(function () {
  const KEY = 'neon-holdem.v1';
  const DEFAULT = () => ({
    name: '플레이어',
    avatar: '🃏',
    chips: 100000,
    xp: 0,
    level: 1,
    created: Date.now(),
    lastBonus: '',
    stats: {
      hands: 0, handsWon: 0, showdownsWon: 0, biggestPot: 0, bluffs: 0, allinWins: 0,
      tournaments: 0, tournamentWins: 0, tournamentITM: 0, headsupWins: 0, headsupPlayed: 0,
      bestHand: -1, bestHandName: '', royal: 0, straightFlush: 0, quads: 0, fullHouse: 0, flush: 0, straight: 0,
      streak: 0, bestStreak: 0, chipsWon: 0, cashWon: 0, missionsDone: 0,
    },
    missions: { date: '', progress: {}, claimed: {}, done: {} },
    achievements: {},
    settings: { quality: 'auto', speed: 'normal', sound: true, fourColor: true, timer: true, autoMuck: false, haptic: true },
  });

  const Profile = {
    data: null,
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        this.data = raw ? Object.assign(DEFAULT(), JSON.parse(raw)) : DEFAULT();
        this.data.stats = Object.assign(DEFAULT().stats, this.data.stats || {});
        this.data.settings = Object.assign(DEFAULT().settings, this.data.settings || {});
        this.data.missions = Object.assign(DEFAULT().missions, this.data.missions || {});
      } catch (e) { this.data = DEFAULT(); }
      return this.data;
    },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* 저장 불가 환경 */ }
    },
    reset() { this.data = DEFAULT(); this.save(); },
    xpForLevel(l) { return Math.round(120 * Math.pow(l, 1.45)); },
    addXp(n) {
      const d = this.data;
      d.xp += n;
      let leveled = 0;
      while (d.xp >= this.xpForLevel(d.level)) { d.xp -= this.xpForLevel(d.level); d.level++; leveled++; d.chips += 2000 * d.level; }
      this.save();
      return leveled;
    },
    addChips(n) { this.data.chips = Math.max(0, Math.round(this.data.chips + n)); this.save(); },
    /* 파산 구제 */
    rescue() {
      const d = this.data;
      if (d.chips < 2000) { d.chips += 20000; this.save(); return true; }
      return false;
    },
    /* 일일 보너스 */
    dailyBonus() {
      const d = this.data;
      const k = U.todayKey();
      if (d.lastBonus !== k) { d.lastBonus = k; d.chips += 10000; this.save(); return 10000; }
      return 0;
    },
  };
  window.Profile = Profile;
})();
