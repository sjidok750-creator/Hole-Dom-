/* ===== 토너먼트 (Sit & Go) 구조 ===== */
(function () {
  const LEVELS = [
    { sb: 25, bb: 50, ante: 0 }, { sb: 50, bb: 100, ante: 0 }, { sb: 75, bb: 150, ante: 0 },
    { sb: 100, bb: 200, ante: 25 }, { sb: 150, bb: 300, ante: 25 }, { sb: 200, bb: 400, ante: 50 },
    { sb: 300, bb: 600, ante: 75 }, { sb: 400, bb: 800, ante: 100 }, { sb: 600, bb: 1200, ante: 150 },
    { sb: 800, bb: 1600, ante: 200 }, { sb: 1000, bb: 2000, ante: 300 }, { sb: 1500, bb: 3000, ante: 400 },
    { sb: 2000, bb: 4000, ante: 500 }, { sb: 3000, bb: 6000, ante: 1000 }, { sb: 4000, bb: 8000, ante: 1000 },
    { sb: 6000, bb: 12000, ante: 2000 }, { sb: 8000, bb: 16000, ante: 2000 }, { sb: 10000, bb: 20000, ante: 3000 },
  ];
  const PAYOUTS = { 2: [1], 3: [0.7, 0.3], 6: [0.65, 0.35], 9: [0.5, 0.3, 0.2] };

  class Tournament {
    constructor(opts) {
      this.n = opts.n; // 참가 인원
      this.buyIn = opts.buyIn;
      this.startStack = opts.startStack || 5000;
      this.handsPerLevel = opts.turbo ? 6 : 10;
      this.turbo = !!opts.turbo;
      this.level = 0;
      this.handsAtLevel = 0;
      this.prizePool = this.buyIn * this.n;
      this.payouts = (PAYOUTS[this.n] || PAYOUTS[9]).map((f) => Math.round(this.prizePool * f));
      this.eliminated = []; // 탈락 순서 (seat)
      this.finished = false;
    }
    blinds() { return LEVELS[Math.min(this.level, LEVELS.length - 1)]; }
    nextLevelIn() { return this.handsPerLevel - this.handsAtLevel; }
    /* 핸드 종료 후 호출 → 레벨업 여부 */
    afterHand() {
      this.handsAtLevel++;
      if (this.handsAtLevel >= this.handsPerLevel && this.level < LEVELS.length - 1) {
        this.level++; this.handsAtLevel = 0; return true;
      }
      return false;
    }
    /* 탈락 처리: busted = 플레이어 배열(칩 0). 동시 탈락은 핸드 시작 칩 순 (많은 쪽이 상위) */
    eliminate(busted) {
      const sorted = busted.slice().sort((a, b) => (a.startChips || 0) - (b.startChips || 0));
      for (const p of sorted) this.eliminated.push(p.seat);
    }
    placeOf(seat, aliveCount) {
      const i = this.eliminated.indexOf(seat);
      if (i >= 0) return this.n - i;
      return aliveCount; // 아직 생존 → 현재 순위 상한
    }
    prizeFor(place) { return this.payouts[place - 1] || 0; }
    itm(place) { return place <= this.payouts.length; }
  }
  Tournament.LEVELS = LEVELS;
  window.Tournament = Tournament;
})();
