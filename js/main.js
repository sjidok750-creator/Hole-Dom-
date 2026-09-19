/* ===== 앱 흐름: 홈 / 모드 설정 / 세션 루프 / 미션 / 설정 ===== */
(function () {
  const SPEEDS = { normal: 1, fast: 0.55, turbo: 0.28 };
  const SPEED_LABEL = { normal: '▶', fast: '⏩', turbo: '⚡' };
  const CASH_STAKES = [
    { key: 'micro', name: '루키', sb: 50, bb: 100, buyIn: 10000, emoji: '🌱', desc: '가볍게 시작' },
    { key: 'low', name: '스탠다드', sb: 100, bb: 200, buyIn: 20000, emoji: '🎲', desc: '기본 테이블' },
    { key: 'mid', name: '하이롤러', sb: 500, bb: 1000, buyIn: 100000, emoji: '💎', desc: '큰 팟, 큰 승부' },
    { key: 'high', name: 'VIP 라운지', sb: 2500, bb: 5000, buyIn: 500000, emoji: '👑', desc: '전설의 테이블' },
  ];
  const BOSSES = [
    { persona: 'fox', stake: 10000, stack: 5000, sb: 25, bb: 50, tag: '입문 보스' },
    { persona: 'wolf', stake: 30000, stack: 6000, sb: 30, bb: 60, tag: '중급 보스' },
    { persona: 'shark', stake: 100000, stack: 8000, sb: 40, bb: 80, tag: '고수 보스' },
    { persona: 'dragon', stake: 300000, stack: 10000, sb: 50, bb: 100, tag: '최종 보스' },
  ];
  const TOURS = [
    { key: 't6', n: 6, buyIn: 20000, emoji: '🥉', name: '6인 Sit & Go', desc: '상위 2명 입상 · 65/35' },
    { key: 't9', n: 9, buyIn: 30000, emoji: '🏆', name: '9인 Sit & Go', desc: '상위 3명 입상 · 50/30/20' },
    { key: 't9h', n: 9, buyIn: 150000, emoji: '💠', name: '하이롤러 9인', desc: '상위 3명 입상 · 큰 상금' },
  ];

  /* ---------------- 세션 ---------------- */
  class Session {
    constructor(cfg) {
      this.cfg = cfg;
      this.mode = cfg.mode;
      this.stopped = false;
      this.lastStage = 'preflop';
      this.lastShowdown = null;
      this.heroInvested = 0;
      this.handsPlayed = 0;
      this.sessionWon = 0;
      const d = Profile.data;
      const hero = { id: 'hero', name: d.name, avatar: d.avatar, chips: cfg.heroChips, isHuman: true };
      const players = [];
      const personas = U.shuffle(AI.PERSONAS.slice());
      const heroSeat = 0;
      players.push(hero);
      for (let i = 1; i < cfg.n; i++) {
        const per = cfg.bosses ? AI.persona(cfg.bosses[i - 1]) : personas[(i - 1) % personas.length];
        players.push({ id: 'ai' + i, name: per.name, avatar: per.emoji, chips: cfg.aiChips || cfg.heroChips, isHuman: false, ai: per });
      }
      this.heroSeat = heroSeat;
      this.game = new PokerGame({
        players, sb: cfg.sb, bb: cfg.bb, ante: cfg.ante || 0, mode: cfg.mode,
        onEvent: (t, d) => this.onEvent(t, d),
        getHumanAction: (p, o) => this.humanAction(p, o),
        getAiAction: (p, o) => this.aiAction(p, o),
      });
      if (cfg.tournament) this.tour = cfg.tournament;
      UI.buildTable(this.game, heroSeat);
      this.updateHud();
    }
    get hero() { return this.game.players[this.heroSeat]; }
    updateHud() {
      const g = this.game;
      const modeName = { cash: '퀵 캐시', headsup: '1:1 헤즈업', tournament: this.tour && this.tour.turbo ? '터보 토너먼트' : '토너먼트' }[this.mode];
      let level = '';
      if (this.tour) level = `LV ${this.tour.level + 1} · ${this.tour.nextLevelIn()}핸드 후 상승 · 생존 ${g.alive().length}/${this.tour.n}`;
      UI.setHud(modeName, `${U.fmt(g.sb)}/${U.fmt(g.bb)}${g.ante ? ' (' + U.fmt(g.ante) + ')' : ''}`, level, null);
    }
    async onEvent(type, data) {
      if (type === 'handStart') { this.lastStage = 'preflop'; this.heroChipsBefore = this.hero.chips + (this.hero.totalBet || 0); }
      if (type === 'street') this.lastStage = data.stage;
      if (type === 'showdown') this.lastShowdown = data;
      if (this.stopped && type !== 'handEnd') return;
      await UI.onEvent(type, data);
    }
    async aiAction(p, opt) {
      const g = this.game;
      const heroActive = this.hero.hand.length && !this.hero.folded;
      let ms = U.rand(380, 900);
      if (opt.callAmt > opt.pot * 0.5) ms += 350;
      if (!heroActive) ms *= 0.35;
      if (opt.numCanAct <= 1) ms *= 0.5;
      await UI.wait(ms);
      const inPosition = p.seat === g.dealer || (g.stage !== 'preflop' && g.nextSeat(p.seat, (q) => !q.folded && !q.out && q.hand.length && !q.allIn) === g.nextSeat(g.dealer));
      return AI.decide(p, opt, { bb: g.bb, inPosition, tournament: this.mode !== 'cash' });
    }
    async humanAction(p, opt) {
      if (this.stopped) return { type: 'fold' };
      return UI.askHuman(p, opt);
    }
    async run() {
      const g = this.game;
      while (!this.stopped) {
        if (this.tour) {
          const b = this.tour.blinds();
          g.setBlinds(b.sb, b.bb, b.ante);
          for (const p of g.players) p.startChips = p.chips;
        }
        this.updateHud();
        const ok = await g.playHand();
        if (!ok || this.stopped) break;
        this.handsPlayed++;
        await this.afterHand();
        if (this.stopped) break;
        const fin = await this.checkEnd();
        if (fin) break;
        await UI.waitNext(UI.speedFactor < 0.5 ? 1200 : 2200);
      }
    }
    async afterHand() {
      const g = this.game, hero = this.hero, d = Profile.data;
      const sd = this.lastShowdown;
      const won = hero.wonThisHand;
      const heroWon = won > 0;
      const lostChips = hero.chips < this.heroChipsBefore;
      d.stats.hands++;
      if (heroWon) {
        d.stats.handsWon++;
        d.stats.streak++;
        d.stats.bestStreak = Math.max(d.stats.bestStreak, d.stats.streak);
        d.stats.chipsWon += won;
        d.stats.biggestPot = Math.max(d.stats.biggestPot, won);
        this.sessionWon += won;
        if (sd && sd.showdown) {
          d.stats.showdownsWon++;
          const c = hero.result ? hero.result.ev.cat : -1;
          if (c > d.stats.bestHand) { d.stats.bestHand = c; d.stats.bestHandName = hero.result.name; }
          if (c === 8) d.stats[hero.result.ev.tb[0] === 12 ? 'royal' : 'straightFlush']++;
          if (c === 7) d.stats.quads++; if (c === 6) d.stats.fullHouse++; if (c === 5) d.stats.flush++; if (c === 4) d.stats.straight++;
        } else if (sd) d.stats.bluffs++;
        if (hero.allIn) d.stats.allinWins++;
      } else if (lostChips) d.stats.streak = 0;
      const xp = heroWon ? 6 + Math.min(20, Math.round(won / g.bb / 4)) : 2;
      const lv = Profile.addXp(xp);
      if (lv) { UI.toast('레벨 업!', `Lv.${d.level} 달성 · 보너스 ${U.fmtFull(2000 * d.level)}칩`, '🆙', 'mission'); Sfx.levelUp(); FX.goldRain(60); }
      const ev = {
        won: heroWon, showdown: !!(sd && sd.showdown && !hero.folded), pot: won, cat: hero.result ? hero.result.ev.cat : -1,
        allIn: heroWon && hero.allIn, stage: this.lastStage, potBB: won / g.bb, streak: d.stats.streak, mode: this.mode,
      };
      this.reportMission('hand', ev);
      if (this.mode === 'cash') Profile.data.pendingTable = { chips: hero.chips };
      Profile.save();
      App.refreshMissionBadge();
    }
    reportMission(type, ev) {
      const done = Missions.report(type, ev);
      for (const m of done) {
        UI.toast('미션 완료: ' + m.title, `+${U.fmtFull(m.reward.chips)}칩 · +${m.reward.xp}XP (홈에서 수령)`, '🎯', 'mission');
        Sfx.mission();
      }
    }
    async checkEnd() {
      const g = this.game, hero = this.hero;
      if (this.mode === 'cash') {
        // AI 리바이
        for (const p of g.players) if (!p.isHuman && p.chips < g.bb * 10) { p.chips = this.cfg.heroChips; p.out = false; UI.updateChips(p); }
        if (hero.chips <= 0) {
          const bank = Profile.data.chips;
          const can = bank >= this.cfg.buyIn;
          const r = await UI.modal({
            title: '칩이 모두 소진되었습니다', sub: `보유 칩 ${U.fmtFull(bank)}`, dismiss: false,
            html: can ? `<p>리바이(${U.fmtFull(this.cfg.buyIn)}칩)하고 계속 플레이할까요?</p>` : `<p>리바이에 필요한 칩이 부족합니다.</p>`,
            buttons: can ? [{ label: '나가기', cls: 'ghost', value: false }, { label: '리바이', cls: 'gold', value: true }] : [{ label: '나가기', cls: 'ghost', value: false }],
          });
          if (r) { Profile.addChips(-this.cfg.buyIn); hero.chips = this.cfg.buyIn; hero.out = false; UI.updateChips(hero); App.renderHome(); return false; }
          await this.finish('bust');
          return true;
        }
        return false;
      }
      if (this.mode === 'headsup') {
        if (hero.chips <= 0) { await this.finish('lose'); return true; }
        if (g.alive().length === 1) { await this.finish('win'); return true; }
        return false;
      }
      if (this.mode === 'tournament') {
        const busted = g.players.filter((p) => !p.out && p.chips <= 0);
        for (const p of busted) p.out = true;
        this.tour.eliminate(busted);
        UI.updateAll();
        const leveled = this.tour.afterHand();
        if (leveled) { const b = this.tour.blinds(); UI.toast('블라인드 상승!', `${U.fmt(b.sb)}/${U.fmt(b.bb)}${b.ante ? ' · 앤티 ' + U.fmt(b.ante) : ''}`, '📈'); Sfx.warn(); }
        for (const p of busted) if (!p.isHuman) UI.toast(`${p.name} 탈락`, `${this.tour.placeOf(p.seat)}위`, '💀');
        const alive = g.alive();
        if (hero.chips <= 0 || alive.length <= 1) {
          const place = hero.chips > 0 ? 1 : this.tour.placeOf(this.heroSeat, alive.length);
          await this.finish('tour', place);
          return true;
        }
        this.updateHud();
        return false;
      }
      return false;
    }
    async finish(reason, place) {
      this.stopped = true;
      this.game.stopped = true;
      UI.stopTimer(); UI.hideActions();
      const d = Profile.data, hero = this.hero;
      let html = '', title = '', sub = '';
      if (this.mode === 'cash') {
        const cashout = Math.max(0, hero.chips);
        Profile.addChips(cashout);
        delete Profile.data.pendingTable;
        const net = this.sessionWon;
        title = reason === 'bust' ? '테이블 퇴장' : '캐시아웃';
        sub = `${this.handsPlayed}핸드 플레이`;
        html = `<div class="result-big"><div class="amt">${U.fmtFull(cashout)} 칩 정산</div></div>` + this.statsHtml([['획득 팟 합계', U.fmtFull(net)], ['보유 칩', U.fmtFull(Profile.data.chips)]]);
      } else if (this.mode === 'headsup') {
        const win = reason === 'win';
        d.stats.headsupPlayed++;
        if (win) { d.stats.headsupWins++; Profile.addChips(this.cfg.stake * 2); Profile.addXp(80); }
        else if (reason === 'leave') { Profile.addChips(Math.max(0, hero.chips)); }
        this.reportMission('headsup', { won: win });
        title = win ? '🏆 헤즈업 승리!' : reason === 'leave' ? '매치 중단' : '패배…';
        sub = `vs ${this.game.players[1].name}`;
        html = `<div class="result-big"><div class="place">${win ? 'WIN' : reason === 'leave' ? '—' : 'LOSE'}</div><div class="amt">${win ? '+' + U.fmtFull(this.cfg.stake * 2) : reason === 'leave' ? U.fmtFull(hero.chips) + ' 칩 정산' : '-' + U.fmtFull(this.cfg.stake)}</div></div>` + this.statsHtml([['핸드', this.handsPlayed], ['보유 칩', U.fmtFull(Profile.data.chips)]]);
        if (win) { Sfx.bigWin(); FX.goldRain(150); } else Sfx.bust();
      } else if (this.mode === 'tournament') {
        const t = this.tour;
        d.stats.tournaments++;
        let prize = 0;
        if (reason === 'leave') { place = t.placeOf(this.heroSeat, this.game.alive().length); }
        else {
          prize = t.prizeFor(place);
          if (place === 1) d.stats.tournamentWins++;
          if (t.itm(place)) d.stats.tournamentITM++;
          Profile.addChips(prize);
          Profile.addXp(place === 1 ? 250 : t.itm(place) ? 120 : 40);
          this.reportMission('tournament', { place, n: t.n, itm: t.itm(place), won: place === 1 });
        }
        title = place === 1 ? '🏆 토너먼트 우승!' : t.itm(place) ? '🎉 입상!' : reason === 'leave' ? '토너먼트 기권' : '탈락';
        sub = `${t.n}인 Sit & Go · 상금풀 ${U.fmtFull(t.prizePool)}`;
        html = `<div class="result-big"><div class="place">${place}위</div><div class="amt">${prize ? '+' + U.fmtFull(prize) : '상금 없음'}</div></div>` + this.statsHtml([['핸드', this.handsPlayed], ['최종 레벨', 'LV ' + (t.level + 1)], ['보유 칩', U.fmtFull(Profile.data.chips)]]);
        if (place === 1) { Sfx.bigWin(); FX.goldRain(200); } else if (t.itm(place)) Sfx.win(); else Sfx.bust();
      }
      Profile.save();
      this.reportMission('bank', { chips: Profile.data.chips });
      await UI.modal({ title, sub, html, grad: true, dismiss: false, buttons: [{ label: '홈으로', cls: 'cyan', value: true }] });
      App.endSession();
    }
    async leave() {
      const g = this.game;
      const midHand = g.stage !== 'idle' && g.stage !== 'showdown' && this.hero.hand.length && !this.hero.folded;
      let msg = this.mode === 'cash' ? '현재 칩을 정산하고 테이블을 떠납니다.' : this.mode === 'headsup' ? '매치를 중단하면 현재 칩만 정산됩니다.' : '토너먼트를 기권하면 바이인은 돌려받지 못합니다.';
      if (midHand) msg += ' 진행 중인 핸드는 폴드 처리됩니다.';
      const r = await UI.modal({ title: '나가시겠어요?', html: `<p>${msg}</p>`, buttons: [{ label: '계속 플레이', cls: 'ghost', value: false }, { label: '나가기', value: true }] });
      if (!r) return;
      this.stopped = true; g.stopped = true;
      if (UI.humanResolve) UI.timeout();
      if (this.mode === 'cash') {
        if (midHand) this.hero.chips = Math.max(0, this.hero.chips);
      }
      await this.finish('leave');
    }
    statsHtml(rows) {
      return `<div class="stat-grid">${rows.map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}</div>`;
    }
  }

  /* ---------------- 앱 ---------------- */
  const App = {
    session: null,
    init() {
      Profile.load();
      const d = Profile.data;
      if (d.pendingTable && d.pendingTable.chips > 0) { d.chips += d.pendingTable.chips; delete d.pendingTable; Profile.save(); }
      Perf.detect();
      UI.init();
      this.applySettings();
      this.bindHome();
      this.renderHome();
      this.showScreen('home');
      Perf.benchmark();
      const bonus = Profile.dailyBonus();
      if (bonus) setTimeout(() => { UI.toast('일일 보너스!', `+${U.fmtFull(bonus)}칩`, '🎁', 'mission'); Sfx.mission(); this.renderHome(); }, 600);
      if (Profile.rescue()) setTimeout(() => { UI.toast('구제 보너스', '+20,000칩 지급', '🛟', 'mission'); this.renderHome(); }, 1400);
      if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
      window.addEventListener('beforeunload', () => { if (this.session && this.session.mode === 'cash') { Profile.data.pendingTable = { chips: this.session.hero.chips }; Profile.save(); } });
    },
    applySettings() {
      const s = Profile.data.settings;
      Perf.setManual(s.quality);
      UI.speedFactor = SPEEDS[s.speed] || 1;
      Sfx.setEnabled(s.sound);
      document.documentElement.dataset.fourcolor = s.fourColor ? 'true' : 'false';
      UI.timerEnabled = s.timer;
      UI.timerSeconds = 20;
      UI.showEquity = s.equity !== false;
      const sb = U.qs('#btn-speed'); if (sb) sb.textContent = SPEED_LABEL[s.speed] || '▶';
    },
    showScreen(id) {
      U.qsa('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + id));
    },
    bindHome() {
      U.qsa('.mode-card').forEach((c) => c.addEventListener('click', () => { Sfx.click(); this.setupMode(c.dataset.mode); }));
      U.qs('#btn-missions').onclick = () => { Sfx.click(); this.openMissions(); };
      U.qs('#btn-settings').onclick = () => { Sfx.click(); this.openSettings(); };
      U.qs('#btn-ranks').onclick = () => { Sfx.click(); this.openRanks(); };
      U.qs('#btn-stats').onclick = () => { Sfx.click(); this.openStats(); };
      U.qs('#btn-leave').onclick = () => { Sfx.click(); if (this.session) this.session.leave(); };
      U.qs('#btn-game-settings').onclick = () => { Sfx.click(); this.openSettings(); };
      U.qs('#btn-speed').onclick = () => { Sfx.click(); this.cycleSpeed(); };
      U.qs('#profile-chip').onclick = () => { Sfx.click(); this.editProfile(); };
    },
    cycleSpeed() {
      const order = ['normal', 'fast', 'turbo'];
      const s = Profile.data.settings;
      s.speed = order[(order.indexOf(s.speed) + 1) % order.length];
      Profile.save(); this.applySettings();
      UI.toast('속도: ' + { normal: '일반', fast: '빠름', turbo: '터보' }[s.speed], null, SPEED_LABEL[s.speed]);
    },
    renderHome() {
      const d = Profile.data;
      U.qs('#bank-amt').textContent = U.fmtFull(d.chips);
      U.qs('#p-name').textContent = d.name;
      U.qs('#p-avatar').textContent = d.avatar;
      U.qs('#p-level').textContent = 'Lv.' + d.level;
      U.qs('#p-xp').style.width = Math.min(100, (d.xp / Profile.xpForLevel(d.level)) * 100) + '%';
      const strip = U.qs('#daily-list');
      strip.innerHTML = '';
      for (const m of Missions.daily()) strip.appendChild(this.missionEl(m));
      this.refreshMissionBadge();
    },
    refreshMissionBadge() {
      const n = Missions.claimable().length;
      const b = U.qs('#mission-badge');
      b.textContent = n; b.classList.toggle('show', n > 0);
    },
    missionEl(m) {
      const prog = Missions.progressOf(m), done = Missions.isDone(m), claimed = Missions.isClaimed(m);
      const el = U.el('div', 'mission-item glass' + (done ? ' done' : '') + (claimed ? ' claimed' : ''));
      el.innerHTML = `<div class="mi-top"><span class="mi-title">${done ? '✅ ' : ''}${m.title}</span><span class="mi-reward"><span class="coin"></span>${U.fmtFull(m.reward.chips)} · ${m.reward.xp}XP</span></div>
        <div class="mi-desc">${m.desc}</div><div class="mi-bar"><i style="width:${Math.min(100, (prog / m.target) * 100)}%"></i></div><div class="mi-foot"><span class="mi-prog">${Math.min(prog, m.target)} / ${m.target}</span>${claimed ? '<span class="mi-prog">수령 완료</span>' : ''}</div>`;
      if (done && !claimed) {
        const b = U.el('button', 'btn gold sm claim', '보상 받기');
        el.querySelector('.mi-foot').appendChild(b);
        b.onclick = (e) => { e.stopPropagation(); const r = Missions.claim(m); if (r) { Sfx.mission(); const c = U.rectCenter(b); FX.burst(c.x, c.y, { count: 40 }); if (r.leveled) { Sfx.levelUp(); UI.toast('레벨 업!', 'Lv.' + Profile.data.level, '🆙', 'mission'); } this.renderHome(); const lst = el.closest('.mlist'); if (lst) el.replaceWith(this.missionEl(m)); } };
      }
      return el;
    },

    /* ----- 모드 설정 ----- */
    async setupMode(mode) {
      const bank = Profile.data.chips;
      const choiceHtml = (items, sel) => `<div class="choice-grid">${items.map((it, i) => `<button class="choice ${i === sel ? 'on' : ''} ${it.locked ? 'locked' : ''}" data-i="${i}"><span class="ch-emoji">${it.emoji}</span><span class="ch-title">${it.title}</span><span class="ch-desc">${it.desc}</span><span class="ch-tag">${it.tag}</span></button>`).join('')}</div>`;
      let items, title, sub;
      if (mode === 'cash') {
        items = CASH_STAKES.map((s) => ({ emoji: s.emoji, title: s.name, desc: `${s.desc} · 블라인드 ${U.fmt(s.sb)}/${U.fmt(s.bb)}`, tag: `바이인 ${U.fmtFull(s.buyIn)}`, locked: bank < s.buyIn, cfg: s }));
        title = '퀵 캐시 게임'; sub = '6인 테이블 · 언제든 나가서 정산';
      } else if (mode === 'headsup') {
        items = BOSSES.map((b) => { const p = AI.persona(b.persona); return { emoji: p.emoji, title: p.name, desc: p.desc, tag: `${b.tag} · 판돈 ${U.fmtFull(b.stake)} → 승리 시 ${U.fmtFull(b.stake * 2)}`, locked: bank < b.stake, cfg: b }; });
        title = '1:1 헤즈업'; sub = '보스를 선택하세요. 상대 칩을 모두 따면 승리!';
      } else {
        items = TOURS.map((t) => ({ emoji: t.emoji, title: t.name, desc: t.desc, tag: `바이인 ${U.fmtFull(t.buyIn)} · 상금풀 ${U.fmtFull(t.buyIn * t.n)}`, locked: bank < t.buyIn, cfg: t }));
        title = 'Sit & Go 토너먼트'; sub = '블라인드가 상승하며 마지막 생존자가 우승';
      }
      let sel = items.findIndex((it) => !it.locked); if (sel < 0) sel = 0;
      let turbo = false;
      const r = await UI.modal({
        title, sub, wide: true, grad: true,
        html: choiceHtml(items, sel) + (mode === 'tournament' ? `<div class="opt-row" style="margin-top:10px"><span class="lab">터보 모드<small>블라인드가 6핸드마다 상승 (기본 10핸드)</small></span><button class="toggle" id="opt-turbo"></button></div>` : ''),
        buttons: [{ label: '취소', cls: 'ghost', value: false }, { label: '입장', cls: 'gold', value: true }],
        onOpen: (m) => {
          m.querySelectorAll('.choice').forEach((c) => c.onclick = () => { sel = +c.dataset.i; m.querySelectorAll('.choice').forEach((x) => x.classList.toggle('on', x === c)); Sfx.click(); });
          const t = m.querySelector('#opt-turbo'); if (t) t.onclick = () => { turbo = !turbo; t.classList.toggle('on', turbo); Sfx.click(); };
        },
      });
      if (!r) return;
      const it = items[sel];
      if (it.locked) { UI.toast('칩이 부족합니다', `필요: ${it.tag}`, '⚠️'); return; }
      this.startSession(mode, it.cfg, { turbo });
    },
    startSession(mode, c, extra) {
      let cfg;
      if (mode === 'cash') {
        Profile.addChips(-c.buyIn);
        cfg = { mode, n: 6, sb: c.sb, bb: c.bb, heroChips: c.buyIn, aiChips: c.buyIn, buyIn: c.buyIn };
        Profile.data.pendingTable = { chips: c.buyIn }; Profile.save();
      } else if (mode === 'headsup') {
        Profile.addChips(-c.stake);
        cfg = { mode, n: 2, sb: c.sb, bb: c.bb, heroChips: c.stack, aiChips: c.stack, stake: c.stake, bosses: [c.persona] };
      } else {
        Profile.addChips(-c.buyIn);
        const t = new Tournament({ n: c.n, buyIn: c.buyIn, startStack: 5000, turbo: extra.turbo });
        const b = t.blinds();
        cfg = { mode, n: c.n, sb: b.sb, bb: b.bb, ante: b.ante, heroChips: 5000, aiChips: 5000, tournament: t };
      }
      this.renderHome();
      this.showScreen('game');
      this.session = new Session(cfg);
      const s = this.session;
      UI.showBanner(cfg.mode === 'tournament' ? '토너먼트 시작' : cfg.mode === 'headsup' ? 'FIGHT!' : '게임 시작', `블라인드 ${U.fmt(cfg.sb)}/${U.fmt(cfg.bb)}`, 'info', 1400);
      Sfx.turn();
      setTimeout(() => { if (this.session === s) s.run().catch((e) => { console.error(e); this.endSession(); }); }, 900);
    },
    endSession() {
      this.session = null;
      UI.hideActions(); UI.stopTimer();
      this.renderHome();
      this.showScreen('home');
    },

    /* ----- 미션 ----- */
    async openMissions() {
      let tab = 'daily';
      const render = (m) => {
        const list = m.querySelector('.mlist');
        list.innerHTML = '';
        const items = tab === 'daily' ? Missions.daily() : Missions.ACHIEVEMENTS;
        for (const it of items) list.appendChild(this.missionEl(it));
        m.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
      };
      await UI.modal({
        title: '🎯 미션', sub: '일일 미션은 매일 자정에 새로 갱신됩니다', wide: true,
        html: `<div class="tabs"><button data-tab="daily">일일 미션</button><button data-tab="ach">업적</button></div><div class="mlist"></div>`,
        buttons: [{ label: '모두 받기', cls: 'gold', value: 'all' }, { label: '닫기', cls: 'ghost', value: true }],
        onOpen: (m, close) => {
          render(m);
          m.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => { tab = b.dataset.tab; Sfx.click(); render(m); });
          m.querySelector('.modal-btns .gold').onclick = () => {
            const r = Missions.claimAll();
            if (r.count) { Sfx.mission(); FX.goldRain(60); UI.toast(`보상 ${r.count}개 수령`, `+${U.fmtFull(r.chips)}칩 · +${r.xp}XP`, '🎁', 'mission'); if (r.leveled) { Sfx.levelUp(); UI.toast('레벨 업!', 'Lv.' + Profile.data.level, '🆙', 'mission'); } }
            else UI.toast('받을 보상이 없습니다', null, '📭');
            this.renderHome(); render(m);
          };
        },
      });
      this.renderHome();
    },

    /* ----- 설정 ----- */
    async openSettings() {
      const s = Profile.data.settings;
      const seg = (id, opts, cur) => `<span class="seg" data-id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" class="${cur === v ? 'on' : ''}">${l}</button>`).join('')}</span>`;
      const tog = (id, on) => `<button class="toggle ${on ? 'on' : ''}" data-id="${id}"></button>`;
      await UI.modal({
        title: '⚙️ 설정', sub: `자동 감지 품질: ${{ high: '높음', medium: '중간', low: '낮음' }[Perf.auto]}`,
        html: `
          <div class="opt-row"><span class="lab">그래픽 품질<small>낮을수록 배터리/발열 절약</small></span>${seg('quality', [['auto', '자동'], ['high', '높음'], ['medium', '중간'], ['low', '낮음']], s.quality)}</div>
          <div class="opt-row"><span class="lab">게임 속도<small>연출/AI 사고 시간</small></span>${seg('speed', [['normal', '일반'], ['fast', '빠름'], ['turbo', '터보']], s.speed)}</div>
          <div class="opt-row"><span class="lab">사운드</span>${tog('sound', s.sound)}</div>
          <div class="opt-row"><span class="lab">4색 덱<small>♦파랑 ♣초록으로 구분</small></span>${tog('fourColor', s.fourColor)}</div>
          <div class="opt-row"><span class="lab">턴 타이머<small>20초 안에 행동 (미행동 시 체크/폴드)</small></span>${tog('timer', s.timer)}</div>
          <div class="opt-row"><span class="lab">승률 표시<small>내 핸드의 예상 승률을 표시</small></span>${tog('equity', s.equity !== false)}</div>
          <div class="opt-row"><span class="lab">데이터 초기화<small>칩·미션·통계가 모두 삭제됩니다</small></span><button class="btn ghost sm" id="btn-reset">초기화</button></div>`,
        buttons: [{ label: '닫기', cls: 'cyan', value: true }],
        onOpen: (m, close) => {
          m.querySelectorAll('.seg').forEach((sg) => sg.querySelectorAll('button').forEach((b) => b.onclick = () => { s[sg.dataset.id] = b.dataset.v; sg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); Profile.save(); this.applySettings(); Sfx.click(); }));
          m.querySelectorAll('.toggle').forEach((t) => t.onclick = () => { const id = t.dataset.id; const cur = id === 'equity' ? s.equity !== false : !!s[id]; s[id] = !cur; t.classList.toggle('on', !cur); Profile.save(); this.applySettings(); Sfx.click(); });
          m.querySelector('#btn-reset').onclick = async () => {
            const ok = await UI.modal({ title: '정말 초기화할까요?', html: '<p>모든 진행 상황이 삭제됩니다.</p>', buttons: [{ label: '취소', cls: 'ghost', value: false }, { label: '초기화', value: true }] });
            if (ok) { Profile.reset(); this.applySettings(); this.renderHome(); close(true); UI.toast('초기화 완료', null, '🧹'); }
          };
        },
      });
    },
    async editProfile() {
      const d = Profile.data;
      const avatars = ['🃏', '😎', '🦄', '👽', '🤠', '🧙', '🐲', '🦁', '👑', '🎩', '💀', '🔥'];
      await UI.modal({
        title: '프로필', html: `<div class="opt-row"><span class="lab">이름</span><input id="p-name-in" maxlength="10" value="${d.name}" style="font:inherit;font-weight:800;padding:8px 12px;border-radius:10px;border:1px solid var(--line);background:var(--glass);color:#fff;width:9em"></div>
          <div class="choice-grid" style="grid-template-columns:repeat(6,1fr)">${avatars.map((a) => `<button class="choice ${a === d.avatar ? 'on' : ''}" data-a="${a}" style="align-items:center"><span class="ch-emoji">${a}</span></button>`).join('')}</div>`,
        buttons: [{ label: '저장', cls: 'cyan', value: true }],
        onOpen: (m) => { m.querySelectorAll('.choice').forEach((c) => c.onclick = () => { d.avatar = c.dataset.a; m.querySelectorAll('.choice').forEach((x) => x.classList.toggle('on', x === c)); Sfx.click(); }); m.querySelector('#p-name-in').oninput = (e) => { d.name = e.target.value.trim() || '플레이어'; }; },
      });
      Profile.save(); this.renderHome();
    },
    openRanks() {
      const rows = [
        ['로열 플러시', 'As Ks Qs Js Ts', '같은 무늬 10-J-Q-K-A'], ['스트레이트 플러시', '9h 8h 7h 6h 5h', '같은 무늬 연속 5장'], ['포카드', 'Kd Kc Kh Ks 3c', '같은 숫자 4장'],
        ['풀하우스', 'Qs Qh Qd 7c 7h', '트리플 + 원페어'], ['플러시', 'Ac Jc 8c 5c 2c', '같은 무늬 5장'], ['스트레이트', 'Tc 9d 8s 7h 6c', '연속 숫자 5장'],
        ['트리플', '8s 8h 8d Ac 4d', '같은 숫자 3장'], ['투페어', 'Jd Jc 5s 5h 9c', '페어 2개'], ['원페어', 'Ah Ad 9s 6c 2d', '같은 숫자 2장'], ['하이카드', 'Ks Qd 8c 5h 2s', '아무 조합도 없음'],
      ];
      UI.modal({
        title: '🃏 핸드 랭킹', sub: '위에서 아래로 강한 순서', wide: true,
        html: `<div class="rank-list">${rows.map(([n, cs, dsc]) => `<div class="rank-row"><span class="rn">${n}</span><span class="cards">${cs.split(' ').map((c) => UI.cardEl(Cards.parse(c), true).outerHTML).join('')}</span><span class="rd">${dsc}</span></div>`).join('')}</div>`,
        buttons: [{ label: '닫기', cls: 'cyan', value: true }],
      });
    },
    openStats() {
      const s = Profile.data.stats;
      const winRate = s.hands ? Math.round((s.handsWon / s.hands) * 100) : 0;
      UI.modal({
        title: '📊 통계', wide: true,
        html: `<div class="stat-grid">${[['총 핸드', U.fmtFull(s.hands)], ['획득 팟', U.fmtFull(s.handsWon) + ` (${winRate}%)`], ['최대 팟', U.fmtFull(s.biggestPot)], ['최고 핸드', s.bestHandName || '-'], ['최다 연승', s.bestStreak], ['쇼다운 없이 승리', s.bluffs], ['올인 승리', s.allinWins], ['헤즈업 승/전', `${s.headsupWins}/${s.headsupPlayed}`], ['토너먼트 우승/입상/출전', `${s.tournamentWins}/${s.tournamentITM}/${s.tournaments}`], ['미션 완료', s.missionsDone], ['플러시 / 풀하우스', `${s.flush} / ${s.fullHouse}`], ['포카드 / 스플', `${s.quads} / ${s.straightFlush + s.royal}`]].map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}</div>`,
        buttons: [{ label: '닫기', cls: 'cyan', value: true }],
      });
    },
  };
  window.App = App;
  window.addEventListener('DOMContentLoaded', () => App.init());
})();
