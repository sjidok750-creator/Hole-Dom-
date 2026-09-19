/* ===== 미션 / 업적 =====
 * 게임 이벤트를 받아 진행도를 갱신. 일일 미션은 날짜 시드로 로테이션.
 */
(function () {
  /* 이벤트 종류:
   *  hand   {won, showdown, pot, cat, allIn, preflopRaiseWin, mode, streak, bluff, comeback}
   *  tournament {place, n, won}
   *  headsup {won}
   *  session {handsThisSession}
   */
  const DAILY_POOL = [
    { id: 'd_hands20', title: '워밍업', desc: '핸드 20번 플레이', target: 20, reward: { chips: 3000, xp: 40 }, on: 'hand', inc: () => 1 },
    { id: 'd_hands50', title: '테이블 마라톤', desc: '핸드 50번 플레이', target: 50, reward: { chips: 8000, xp: 90 }, on: 'hand', inc: () => 1 },
    { id: 'd_win10', title: '팟 헌터', desc: '팟 10개 획득', target: 10, reward: { chips: 5000, xp: 60 }, on: 'hand', inc: (e) => (e.won ? 1 : 0) },
    { id: 'd_bluff3', title: '포커페이스', desc: '쇼다운 없이 팟 3개 획득', target: 3, reward: { chips: 4000, xp: 60 }, on: 'hand', inc: (e) => (e.won && !e.showdown ? 1 : 0) },
    { id: 'd_flush', title: '플러시 피니시', desc: '플러시 이상으로 쇼다운 승리', target: 1, reward: { chips: 6000, xp: 80 }, on: 'hand', inc: (e) => (e.won && e.showdown && e.cat >= 5 ? 1 : 0) },
    { id: 'd_straight', title: '일직선', desc: '스트레이트로 쇼다운 승리', target: 1, reward: { chips: 4000, xp: 60 }, on: 'hand', inc: (e) => (e.won && e.showdown && e.cat === 4 ? 1 : 0) },
    { id: 'd_twopair3', title: '더블 트러블', desc: '투페어 이상으로 3번 승리', target: 3, reward: { chips: 4500, xp: 60 }, on: 'hand', inc: (e) => (e.won && e.showdown && e.cat >= 2 ? 1 : 0) },
    { id: 'd_allin', title: '올인 승부사', desc: '올인으로 승리 1회', target: 1, reward: { chips: 7000, xp: 90 }, on: 'hand', inc: (e) => (e.won && e.allIn ? 1 : 0) },
    { id: 'd_streak3', title: '핫 스트릭', desc: '3연승 달성', target: 3, reward: { chips: 5000, xp: 70 }, on: 'hand', set: (e) => e.streak },
    { id: 'd_bigpot', title: '빅 팟', desc: '한 번에 50BB 이상 팟 획득', target: 1, reward: { chips: 6000, xp: 80 }, on: 'hand', inc: (e) => (e.won && e.potBB >= 50 ? 1 : 0) },
    { id: 'd_preflop3', title: '프리플랍 킹', desc: '프리플랍에서 팟 3개 획득', target: 3, reward: { chips: 3500, xp: 50 }, on: 'hand', inc: (e) => (e.won && e.stage === 'preflop' ? 1 : 0) },
    { id: 'd_hu1', title: '결투', desc: '1:1 헤즈업 승리', target: 1, reward: { chips: 8000, xp: 120 }, on: 'headsup', inc: (e) => (e.won ? 1 : 0) },
    { id: 'd_itm', title: '입상', desc: '토너먼트 상금권 진입', target: 1, reward: { chips: 10000, xp: 150 }, on: 'tournament', inc: (e) => (e.itm ? 1 : 0) },
    { id: 'd_tourplay', title: '출전', desc: '토너먼트 1회 완주', target: 1, reward: { chips: 4000, xp: 60 }, on: 'tournament', inc: () => 1 },
    { id: 'd_trips', title: '세 쌍둥이', desc: '트리플 이상으로 2번 승리', target: 2, reward: { chips: 5000, xp: 70 }, on: 'hand', inc: (e) => (e.won && e.showdown && e.cat >= 3 ? 1 : 0) },
    { id: 'd_river', title: '리버 마스터', desc: '리버까지 가서 5번 승리', target: 5, reward: { chips: 5000, xp: 70 }, on: 'hand', inc: (e) => (e.won && e.stage === 'river' ? 1 : 0) },
  ];

  const ACHIEVEMENTS = [
    { id: 'a_first', title: '첫 승리', desc: '첫 팟 획득', target: 1, reward: { chips: 2000, xp: 30 }, on: 'hand', inc: (e) => (e.won ? 1 : 0) },
    { id: 'a_hands100', title: '100핸드', desc: '핸드 100번 플레이', target: 100, reward: { chips: 5000, xp: 100 }, on: 'hand', inc: () => 1 },
    { id: 'a_hands1000', title: '1000핸드', desc: '핸드 1000번 플레이', target: 1000, reward: { chips: 50000, xp: 500 }, on: 'hand', inc: () => 1 },
    { id: 'a_fullhouse', title: '만원 하우스', desc: '풀하우스로 승리', target: 1, reward: { chips: 5000, xp: 80 }, on: 'hand', inc: (e) => (e.won && e.showdown && e.cat === 6 ? 1 : 0) },
    { id: 'a_quads', title: '포카드!', desc: '포카드로 승리', target: 1, reward: { chips: 15000, xp: 200 }, on: 'hand', inc: (e) => (e.won && e.showdown && e.cat === 7 ? 1 : 0) },
    { id: 'a_sf', title: '전설', desc: '스트레이트 플러시로 승리', target: 1, reward: { chips: 50000, xp: 500 }, on: 'hand', inc: (e) => (e.won && e.showdown && e.cat === 8 ? 1 : 0) },
    { id: 'a_streak5', title: '불꽃', desc: '5연승', target: 5, reward: { chips: 10000, xp: 150 }, on: 'hand', set: (e) => e.streak },
    { id: 'a_hu5', title: '듀얼리스트', desc: '헤즈업 5승', target: 5, reward: { chips: 15000, xp: 200 }, on: 'headsup', inc: (e) => (e.won ? 1 : 0) },
    { id: 'a_tour1', title: '챔피언', desc: '토너먼트 우승', target: 1, reward: { chips: 20000, xp: 300 }, on: 'tournament', inc: (e) => (e.place === 1 ? 1 : 0) },
    { id: 'a_tour3', title: '왕조', desc: '토너먼트 3회 우승', target: 3, reward: { chips: 60000, xp: 600 }, on: 'tournament', inc: (e) => (e.place === 1 ? 1 : 0) },
    { id: 'a_bluff20', title: '거짓말쟁이', desc: '쇼다운 없이 20팟 획득', target: 20, reward: { chips: 8000, xp: 120 }, on: 'hand', inc: (e) => (e.won && !e.showdown ? 1 : 0) },
    { id: 'a_allin10', title: '심장이 강한', desc: '올인 승리 10회', target: 10, reward: { chips: 12000, xp: 150 }, on: 'hand', inc: (e) => (e.won && e.allIn ? 1 : 0) },
    { id: 'a_million', title: '백만장자', desc: '보유 칩 1,000,000 달성', target: 1, reward: { chips: 0, xp: 1000 }, on: 'bank', inc: (e) => (e.chips >= 1000000 ? 1 : 0) },
  ];

  const Missions = {
    DAILY_POOL, ACHIEVEMENTS,
    bus: new U.Emitter(),

    daily() {
      const d = Profile.data;
      const key = U.todayKey();
      if (d.missions.date !== key) {
        d.missions.date = key;
        d.missions.progress = {};
        d.missions.claimed = {};
        Profile.save();
      }
      const rnd = U.seeded('daily-' + key);
      const pool = DAILY_POOL.slice();
      const out = [];
      while (out.length < 4 && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
      return out;
    },
    progressOf(m) {
      const d = Profile.data;
      return m.id.startsWith('a_') ? (d.achievements[m.id] || 0) : (d.missions.progress[m.id] || 0);
    },
    isClaimed(m) {
      const d = Profile.data;
      return m.id.startsWith('a_') ? !!d.achievements[m.id + ':claimed'] : !!d.missions.claimed[m.id];
    },
    isDone(m) { return this.progressOf(m) >= m.target; },
    claimable() { return this.daily().concat(ACHIEVEMENTS).filter((m) => this.isDone(m) && !this.isClaimed(m)); },

    /* 이벤트 처리 → 완료된 미션 목록 반환 */
    report(type, e) {
      const d = Profile.data;
      const completed = [];
      const apply = (m, store) => {
        if (m.on !== type) return;
        const before = store[m.id] || 0;
        if (before >= m.target) return;
        let after = before;
        if (m.set) after = Math.max(before, m.set(e) || 0);
        else after = before + (m.inc(e) || 0);
        if (after !== before) {
          store[m.id] = after;
          if (after >= m.target) completed.push(m);
        }
      };
      for (const m of this.daily()) apply(m, d.missions.progress);
      for (const m of ACHIEVEMENTS) apply(m, d.achievements);
      if (completed.length) {
        d.stats.missionsDone += completed.length;
        for (const m of completed) this.bus.emit('complete', m);
      }
      Profile.save();
      return completed;
    },
    claim(m) {
      const d = Profile.data;
      if (!this.isDone(m) || this.isClaimed(m)) return null;
      if (m.id.startsWith('a_')) d.achievements[m.id + ':claimed'] = true; else d.missions.claimed[m.id] = true;
      d.chips += m.reward.chips;
      const lv = Profile.addXp(m.reward.xp);
      Profile.save();
      return { reward: m.reward, leveled: lv };
    },
    claimAll() {
      let total = { chips: 0, xp: 0, leveled: 0, count: 0 };
      for (const m of this.claimable()) {
        const r = this.claim(m);
        if (r) { total.chips += r.reward.chips; total.xp += r.reward.xp; total.leveled += r.leveled; total.count++; }
      }
      return total;
    },
  };
  window.Missions = Missions;
})();
