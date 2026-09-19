/* ===== 테이블 UI / 연출 ===== */
(function () {
  const UI = {
    speedFactor: 1,
    els: {},
    seats: [],
    heroSeat: 0,
    game: null,
    humanResolve: null,
    timerHandle: null,
    showEquity: true,
    reveal: new Set(),

    d(ms) { return Math.round(ms * this.speedFactor * (Perf.reducedMotion ? 0.6 : 1)); },
    wait(ms) { return U.sleep(this.d(ms)); },

    init() {
      const q = (s) => U.qs(s);
      this.els = {
        wrap: q('#table-wrap'), seats: q('#seats'), board: q('#board'), pot: q('#pot'), potAmt: q('#pot-amt'), sidePots: q('#side-pots'),
        dealer: q('#dealer-btn'), fly: q('#fly-layer'), banner: q('#banner'), bar: q('#action-bar'), raisePanel: q('#raise-panel'),
        slider: q('#raise-slider'), raiseAmt: q('#raise-amt'), btnFold: q('#btn-fold'), btnCheck: q('#btn-check'), btnRaise: q('#btn-raise'),
        actionBtns: q('#action-btns'), nextWrap: q('#next-wrap'), hudMode: q('#hud-mode'), hudBlinds: q('#hud-blinds'), hudLevel: q('#hud-level'), hudHand: q('#hud-hand'),
      };
      window.addEventListener('resize', () => this.layout());
      if (window.ResizeObserver) {
        let raf = 0;
        new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => this.layout()); }).observe(this.els.wrap);
      }
      window.addEventListener('orientationchange', () => setTimeout(() => this.layout(), 150));
      this.bindActions();
    },

    /* ---------- 테이블 구성 ---------- */
    buildTable(game, heroSeat) {
      this.game = game;
      this.heroSeat = heroSeat;
      this.reveal = new Set();
      const S = this.els.seats;
      S.innerHTML = '';
      this.seats = [];
      game.players.forEach((p) => {
        const seat = U.el('div', 'seat' + (p.isHuman ? ' hero' : ''));
        seat.dataset.seat = p.seat;
        seat.innerHTML = `
          <div class="seat-cards"></div>
          <div class="avatar-wrap">
            <svg class="timer-ring" viewBox="0 0 100 100"><circle class="bgc" cx="50" cy="50" r="46"></circle><circle class="fgc" cx="50" cy="50" r="46" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"></circle></svg>
            <div class="avatar">${p.avatar || (p.ai && p.ai.emoji) || '🙂'}</div>
            <div class="seat-status"></div>
          </div>
          <div class="seat-info"><div class="seat-name">${p.name}</div><div class="seat-chips">${U.fmt(p.chips)}</div>${p.isHuman ? '<div class="seat-hand" id="hero-hand"></div>' : ''}</div>`;
        const bet = U.el('div', 'seat-bet', '<span class="chip-icon c1"></span><b>0</b>');
        S.appendChild(seat); S.appendChild(bet);
        this.seats.push({ el: seat, bet, cards: seat.querySelector('.seat-cards'), chips: seat.querySelector('.seat-chips'), status: seat.querySelector('.seat-status'), avatar: seat.querySelector('.avatar-wrap'), ring: seat.querySelector('.fgc'), ringSvg: seat.querySelector('.timer-ring') });
      });
      this.els.board.innerHTML = '';
      for (let i = 0; i < 5; i++) this.els.board.appendChild(U.el('div', 'slot'));
      this.setPot(0);
      this.els.sidePots.innerHTML = '';
      this.hideBanner();
      this.layout();
    },

    seatPos(i) {
      const n = this.game.players.length;
      const k = (i - this.heroSeat + n) % n;
      const W = this.els.wrap.clientWidth, H = this.els.wrap.clientHeight;
      const portrait = H > W;
      const ang = Math.PI / 2 + (k * 2 * Math.PI) / n;
      const rx = W * (portrait ? 0.40 : 0.42), ry = H * (portrait ? 0.37 : 0.35);
      const cx = W / 2, cy = H * (portrait ? 0.5 : 0.5);
      let x = cx + rx * Math.cos(ang), y = cy + ry * Math.sin(ang);
      if (k === 0) y = H * (portrait ? 0.88 : 0.85);
      return { x, y, cx, cy, ang };
    },

    layout() {
      if (!this.game) return;
      const n = this.game.players.length;
      const H = this.els.wrap.clientHeight;
      for (let i = 0; i < n; i++) {
        const s = this.seats[i];
        const p = this.seatPos(i);
        if (i === this.heroSeat) p.y = Math.min(p.y, H - s.el.offsetHeight / 2 - 4);
        s.el.style.left = p.x + 'px'; s.el.style.top = p.y + 'px';
        if (i === this.heroSeat) {
          // 히어로: 큰 카드 왼쪽에 베팅 표시
          const r = s.el.getBoundingClientRect(), wr = this.els.wrap.getBoundingClientRect();
          s.bet.style.left = (r.left - wr.left - 44) + 'px';
          s.bet.style.top = (r.top - wr.top + 36) + 'px';
        } else {
          const t = 0.36 + 0.22 * Math.max(0, -Math.sin(p.ang)); // 상단 좌석은 정보 박스를 피해 더 안쪽
          s.bet.style.left = U.lerp(p.x, p.cx, t) + 'px';
          s.bet.style.top = U.lerp(p.y, p.cy, t) + 'px';
        }
      }
      this.placeDealer();
    },
    placeDealer() {
      const g = this.game;
      if (!g || g.dealer < 0) return;
      const p = this.seatPos(g.dealer);
      let x, y;
      if (g.dealer === this.heroSeat) {
        const r = this.seats[g.dealer].el.getBoundingClientRect(), wr = this.els.wrap.getBoundingClientRect();
        x = r.right - wr.left + 44; y = r.top - wr.top + 36;
      } else {
        const av = this.seats[g.dealer].avatar.getBoundingClientRect().width || 60;
        x = U.lerp(p.x, p.cx, 0.36) + Math.cos(p.ang + Math.PI / 2) * av * 0.9;
        y = U.lerp(p.y, p.cy, 0.36) + Math.sin(p.ang + Math.PI / 2) * av * 0.9;
      }
      this.els.dealer.style.left = x + 'px'; this.els.dealer.style.top = y + 'px';
      this.els.dealer.style.display = 'grid';
    },

    /* ---------- 카드 ---------- */
    cardEl(c, faceUp) {
      const el = U.el('div', 'card');
      if (faceUp) this.setFace(el, c); else el.classList.add('back');
      return el;
    },
    setFace(el, c) {
      el.classList.remove('back');
      el.classList.add(Cards.SUIT_NAMES[Cards.suit(c)]);
      const r = Cards.rankChar(c), s = Cards.suitChar(c);
      el.innerHTML = `<span class="card-rank">${r}</span><span class="card-suit">${s}</span><span class="card-big">${s}</span>`;
      el.dataset.card = c;
    },
    async flipCard(el, c) {
      if (el.dataset.card != null) return;
      el.classList.remove('flip-in');
      this.setFace(el, c);
      void el.offsetWidth;
      el.classList.add('flip-in');
      Sfx.flip();
    },

    /* ---------- 표시 갱신 ---------- */
    setPot(n) { this.els.potAmt.textContent = U.fmtFull(n); },
    bumpPot() { const p = this.els.pot; p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); },
    updateChips(p) { this.seats[p.seat].chips.textContent = U.fmtFull(p.chips); },
    updateAll() { for (const p of this.game.players) { this.updateChips(p); this.seats[p.seat].el.classList.toggle('out', !!p.out); } },
    setBet(p) {
      const b = this.seats[p.seat].bet;
      if (p.bet > 0) {
        b.querySelector('b').textContent = U.fmtFull(p.bet);
        b.querySelector('.chip-icon').className = 'chip-icon ' + this.chipClass(p.bet);
        b.classList.add('show');
      } else b.classList.remove('show');
    },
    chipClass(amt) {
      const bb = this.game.bb;
      return amt >= bb * 50 ? 'c4' : amt >= bb * 20 ? 'c5' : amt >= bb * 8 ? 'c6' : amt >= bb * 3 ? 'c3' : amt >= bb ? 'c2' : 'c1';
    },
    status(seat, text, cls, sticky) {
      const s = this.seats[seat].status;
      s.className = 'seat-status ' + (cls || '');
      s.textContent = text;
      void s.offsetWidth;
      s.classList.add('show');
      clearTimeout(s._t);
      if (!sticky) s._t = setTimeout(() => s.classList.remove('show'), this.d(2200));
    },
    clearStatus(seat) { const s = this.seats[seat].status; clearTimeout(s._t); s.classList.remove('show'); },
    setActing(seat) {
      this.seats.forEach((s, i) => s.el.classList.toggle('acting', i === seat));
    },
    setHud(mode, blinds, level, hand) {
      if (mode != null) this.els.hudMode.textContent = mode;
      if (blinds != null) this.els.hudBlinds.textContent = blinds;
      if (level != null) this.els.hudLevel.textContent = level;
      if (hand != null) this.els.hudHand.textContent = hand;
    },

    /* ---------- 칩 애니메이션 ---------- */
    flyChips(from, to, amount, opts) {
      opts = opts || {};
      const layer = this.els.fly;
      const wr = layer.getBoundingClientRect();
      const n = Math.min(6, Math.max(1, Math.round(Math.log2(Math.max(2, amount / this.game.bb)))));
      const el = U.el('div', 'fly-chip stack');
      const cls = this.chipClass(amount);
      for (let i = 0; i < n; i++) el.appendChild(U.el('span', 'chip-icon ' + cls));
      el.style.left = (from.x - wr.left) + 'px'; el.style.top = (from.y - wr.top) + 'px';
      layer.appendChild(el);
      const dur = this.d(opts.dur || 420);
      el.style.transitionDuration = dur + 'ms';
      void el.offsetWidth;
      el.style.left = (to.x - wr.left) + 'px'; el.style.top = (to.y - wr.top) + 'px';
      setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 200); }, dur);
      return U.sleep(dur);
    },
    centerOf(el) { return U.rectCenter(el); },

    /* ---------- 엔진 이벤트 ---------- */
    async onEvent(type, data) {
      const g = this.game;
      switch (type) {
        case 'handStart': {
          this.hideBanner();
          this.reveal = new Set();
          for (const s of this.seats) { s.cards.innerHTML = ''; s.el.classList.remove('folded', 'winner', 'acting'); s.bet.classList.remove('show'); this.clearStatus(+s.el.dataset.seat); }
          this.els.board.querySelectorAll('.card').forEach((c) => c.replaceWith(U.el('div', 'slot')));
          this.els.sidePots.innerHTML = '';
          this.setHud(null, null, null, '#' + data.handNo);
          this.updateAll();
          this.placeDealer();
          this.setPot(g.pot());
          for (const p of g.players) this.setBet(p);
          this.status(data.sbIdx, 'SB', 'blind');
          this.status(data.bbIdx, 'BB', 'blind');
          if (data.ante) { this.bumpPot(); }
          Sfx.chip();
          this.updateHeroHint();
          await this.wait(260);
          break;
        }
        case 'deal': {
          const order = [];
          const n = g.players.length;
          let idx = g.sbIdx;
          for (let k = 0; k < n; k++) { const p = g.players[idx]; if (p.hand.length) order.push(p); idx = (idx + 1) % n; }
          const dRect = this.centerOf(this.els.dealer);
          for (let c = 0; c < 2; c++) {
            for (const p of order) {
              const s = this.seats[p.seat];
              const el = this.cardEl(p.hand[c], p.isHuman);
              el.classList.add('dealing');
              s.cards.appendChild(el);
              const r = el.getBoundingClientRect();
              const dx = dRect.x - (r.left + r.width / 2), dy = dRect.y - (r.top + r.height / 2);
              const base = el.style.transform;
              el.style.transform = `translate(${dx}px, ${dy}px) scale(0.5) rotate(${U.rand(-40, 40)}deg)`;
              el.style.opacity = '0.2';
              void el.offsetWidth;
              el.style.transform = base; el.style.opacity = '1';
              Sfx.deal();
              await this.wait(this.speedFactor < 0.5 ? 25 : 70);
            }
          }
          await this.wait(200);
          this.seats.forEach((s) => s.cards.querySelectorAll('.card').forEach((c) => { c.classList.remove('dealing'); c.style.transform = ''; }));
          this.updateHeroHint();
          break;
        }
        case 'turn': {
          this.setActing(data.seat);
          if (g.players[data.seat].isHuman) Sfx.turn();
          break;
        }
        case 'action': {
          const p = g.players[data.seat];
          const a = data.action;
          const s = this.seats[p.seat];
          this.setActing(-1);
          this.updateChips(p);
          const label = { fold: '폴드', check: '체크', call: '콜', bet: '벳', raise: '레이즈' }[a.type] || a.type;
          if (a.allIn && a.type !== 'fold') { this.status(p.seat, 'ALL-IN', 'allin', true); Sfx.allin(); if (p.isHuman) FX.shake(300); }
          else this.status(p.seat, label + (a.amount ? ' ' + U.fmt(a.to) : ''), a.type);
          if (a.type === 'fold') {
            s.el.classList.add('folded');
            s.cards.querySelectorAll('.card').forEach((c) => c.classList.add('dim'));
            Sfx.fold();
          } else if (a.type === 'check') {
            Sfx.check();
          } else {
            if (a.amount > 0) {
              const from = this.centerOf(s.avatar), to = this.centerOf(s.bet);
              this.setBet(p);
              this.flyChips(from, to, a.amount, { dur: 260 });
              a.type === 'call' ? Sfx.chip() : Sfx.chips();
            }
          }
          this.setPot(g.pot());
          if (p.isHuman) this.updateHeroHint();
          await this.wait(a.type === 'fold' ? 160 : 260);
          break;
        }
        case 'collect': {
          if (data.moved.length) {
            const to = this.centerOf(this.els.pot);
            const ps = data.moved.map((m) => this.flyChips(this.centerOf(this.seats[m.seat].bet), to, m.amount, { dur: 380 }));
            for (const s of this.seats) s.bet.classList.remove('show');
            await Promise.all(ps);
            this.setPot(data.pot); this.bumpPot(); Sfx.chips();
          }
          await this.wait(120);
          break;
        }
        case 'street': {
          const slots = this.els.board.querySelectorAll('.slot');
          for (let i = 0; i < data.newCards.length; i++) {
            const el = this.cardEl(data.newCards[i], true);
            el.classList.add('flip-in');
            slots[i].replaceWith(el);
            Sfx.flip();
            await this.wait(140);
          }
          this.updateHeroHint();
          await this.wait(this.allInMode ? 650 : 320);
          break;
        }
        case 'runout': {
          // 올인 상황: 남은 플레이어 카드 공개
          if (!this.allInMode) {
            this.allInMode = true;
            for (const p of g.inHand()) if (!p.isHuman) await this.revealSeat(p);
            await this.wait(500);
          }
          break;
        }
        case 'refund': {
          const p = g.players[data.seat];
          await this.flyChips(this.centerOf(this.els.pot), this.centerOf(this.seats[p.seat].avatar), data.amount, { dur: 300 });
          this.updateChips(p);
          this.setPot(g.pot());
          break;
        }
        case 'showdown': {
          await this.showdown(data);
          break;
        }
        case 'handEnd': {
          this.allInMode = false;
          this.setActing(-1);
          break;
        }
      }
    },

    async revealSeat(p) {
      if (this.reveal.has(p.seat)) return;
      this.reveal.add(p.seat);
      const s = this.seats[p.seat];
      const cards = s.cards.querySelectorAll('.card');
      for (let i = 0; i < cards.length; i++) { await this.flipCard(cards[i], p.hand[i]); await this.wait(70); }
    },

    async showdown(data) {
      const g = this.game;
      const hero = g.players[this.heroSeat];
      const heroWon = data.pots.some((pt) => pt.winners.includes(this.heroSeat));
      const totalWon = hero.wonThisHand;
      if (data.showdown) {
        // 카드 공개 (승자 먼저가 아닌 순서대로)
        const contenders = g.inHand();
        for (const p of contenders) if (!p.isHuman) await this.revealSeat(p);
        await this.wait(250);
        // 핸드 이름 표시
        for (const p of contenders) {
          this.status(p.seat, p.result.name, 'blind', true);
        }
        await this.wait(650);
        // 승자 하이라이트
        const mainPot = data.pots[data.pots.length - 1];
        const boardCards = Array.from(this.els.board.querySelectorAll('.card'));
        for (const pt of data.pots) {
          for (const w of pt.winners) {
            const p = g.players[w];
            const best = new Set(p.result.best);
            this.seats[w].cards.querySelectorAll('.card').forEach((c) => { if (best.has(+c.dataset.card)) c.classList.add('hi'); });
            boardCards.forEach((c) => { if (best.has(+c.dataset.card)) c.classList.add('hi'); });
          }
        }
        for (const p of contenders) if (!data.pots.some((pt) => pt.winners.includes(p.seat))) this.seats[p.seat].cards.querySelectorAll('.card').forEach((c) => c.classList.add('dim'));
        await this.wait(500);
      }
      // 팟 이동
      const potC = this.centerOf(this.els.pot);
      const winSeats = new Set();
      for (const pt of data.pots) {
        const ps = [];
        for (const w of pt.winners) {
          winSeats.add(w);
          const s = this.seats[w];
          s.el.classList.add('winner');
          const share = Math.floor(pt.amount / pt.winners.length);
          ps.push(this.flyChips(potC, this.centerOf(s.avatar), share, { dur: 520 }));
          const c = this.centerOf(s.avatar);
          setTimeout(() => { FX.floatText(c.x, c.y - 30, '+' + U.fmtFull(share)); FX.sparkle(c.x, c.y, 16); }, this.d(480));
        }
        this.status(pt.winners[0], pt.showdown ? '승리 · ' + pt.hand : '승리', 'win', true);
        await Promise.all(ps);
        this.setPot(0);
        for (const w of pt.winners) this.updateChips(g.players[w]);
        if (data.pots.length > 1) await this.wait(250);
      }
      // 배너 & 이펙트
      const bb = g.bb;
      if (heroWon) {
        const big = totalWon >= bb * 30;
        const potInfo = data.pots.find((pt) => pt.winners.includes(this.heroSeat));
        const title = big ? 'BIG WIN!' : '승리!';
        const sub = (potInfo && potInfo.showdown ? potInfo.hand + ' · ' : '') + '+' + U.fmtFull(totalWon);
        this.showBanner(title, sub, 'win');
        const c = this.centerOf(this.seats[this.heroSeat].avatar);
        if (big) { Sfx.bigWin(); FX.burst(c.x, c.y, { count: 140, speed: 620 }); FX.goldRain(80); FX.flash('rgba(255,209,102,0.35)'); }
        else { Sfx.win(); FX.burst(c.x, c.y, { count: 60, speed: 420 }); }
      } else if (hero.hand.length && !hero.folded && data.showdown) {
        const w = g.players[data.pots[data.pots.length - 1].winners[0]];
        this.showBanner(w.name + ' 승리', data.pots[data.pots.length - 1].hand || '', 'lose');
        Sfx.lose();
      } else {
        const w = g.players[data.pots[data.pots.length - 1].winners[0]];
        this.showBanner(w.name + ' 승리', data.pots.length > 1 ? '사이드 팟 포함' : (data.pots[0].showdown ? data.pots[0].hand : '모두 폴드'), 'info');
      }
      await this.wait(heroWon ? 1300 : 900);
    },

    showBanner(title, sub, cls, autoHide) {
      const b = this.els.banner;
      b.className = 'banner ' + (cls || '');
      b.innerHTML = `<h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}`;
      void b.offsetWidth;
      b.classList.add('show');
      clearTimeout(this._bt);
      if (autoHide) this._bt = setTimeout(() => this.hideBanner(), autoHide);
    },
    hideBanner() { this.els.banner.classList.remove('show'); },

    /* ---------- 히어로 핸드 힌트 ---------- */
    updateHeroHint() {
      const g = this.game; if (!g) return;
      const el = U.qs('#hero-hand'); if (!el) return;
      const hero = g.players[this.heroSeat];
      if (!hero.hand.length || hero.out) { el.textContent = ''; return; }
      if (hero.folded) { el.textContent = '폴드'; return; }
      let name;
      if (g.board.length >= 3) name = HandEval.describe(HandEval.evaluate(hero.hand.concat(g.board)));
      else {
        const r1 = Cards.rank(hero.hand[0]), r2 = Cards.rank(hero.hand[1]);
        const suited = Cards.suit(hero.hand[0]) === Cards.suit(hero.hand[1]);
        name = r1 === r2 ? Cards.rankChar(hero.hand[0]) + ' 포켓 페어' : Cards.rankChar(hero.hand[Math.max(r1, r2) === r1 ? 0 : 1]) + Cards.rankChar(hero.hand[Math.max(r1, r2) === r1 ? 1 : 0]) + (suited ? ' 수티드' : ' 오프수트');
      }
      let eq = '';
      if (this.showEquity && g.board.length < 5) {
        const opp = Math.max(1, g.inHand().length - 1);
        const e = HandEval.equity(hero.hand, g.board, Math.min(opp, 3), Perf.tier === 'low' ? 80 : 160);
        eq = `<span class="eq">${Math.round(e * 100)}%</span>`;
      } else if (this.showEquity && g.board.length === 5 && !g.stage.startsWith('show')) {
        const opp = Math.max(1, g.inHand().length - 1);
        const e = HandEval.equity(hero.hand, g.board, Math.min(opp, 3), 120);
        eq = `<span class="eq">${Math.round(e * 100)}%</span>`;
      }
      el.innerHTML = name + eq;
    },

    /* ---------- 액션 바 ---------- */
    bindActions() {
      const E = this.els;
      const resolve = (a) => { if (this.humanResolve) { const r = this.humanResolve; this.humanResolve = null; this.stopTimer(); this.hideActions(); Sfx.click(); r(a); } };
      E.btnFold.onclick = () => resolve({ type: 'fold' });
      E.btnCheck.onclick = () => resolve({ type: this.curOpt.canCheck ? 'check' : 'call' });
      E.btnRaise.onclick = () => {
        if (!this.curOpt.canRaise) return;
        resolve({ type: 'raise', amount: +E.slider.value });
      };
      E.slider.oninput = () => this.updateRaiseLabel();
      U.qsa('#raise-panel .presets button').forEach((b) => {
        b.onclick = () => {
          const o = this.curOpt; if (!o) return;
          const pot = o.pot + o.callAmt;
          let v;
          switch (b.dataset.preset) {
            case 'min': v = o.minRaiseTo; break;
            case 'third': v = o.currentBet + Math.round(pot / 3) + o.callAmt; break;
            case 'half': v = o.currentBet + Math.round(pot / 2) + o.callAmt; break;
            case 'pot': v = o.currentBet + pot + o.callAmt; break;
            case 'allin': v = o.maxRaiseTo; break;
          }
          v = U.clamp(Math.round(v / (this.game.sb)) * this.game.sb, o.minRaiseTo, o.maxRaiseTo);
          E.slider.value = v; this.updateRaiseLabel();
          U.qsa('#raise-panel .presets button').forEach((x) => x.classList.toggle('on', x === b));
          Sfx.click();
        };
      });
      document.addEventListener('keydown', (e) => {
        if (!this.humanResolve) return;
        const k = e.key.toLowerCase();
        if (k === 'f') E.btnFold.click();
        else if (k === 'c' || k === ' ') { e.preventDefault(); E.btnCheck.click(); }
        else if (k === 'r' || k === 'enter') E.btnRaise.click();
        else if (k === 'a') { E.slider.value = this.curOpt.maxRaiseTo; this.updateRaiseLabel(); }
        else if (k === 'arrowup' || k === 'arrowright') { E.slider.stepUp(); this.updateRaiseLabel(); }
        else if (k === 'arrowdown' || k === 'arrowleft') { E.slider.stepDown(); this.updateRaiseLabel(); }
      });
    },
    updateRaiseLabel() {
      const E = this.els, o = this.curOpt; if (!o) return;
      const v = +E.slider.value;
      const allin = v >= o.maxRaiseTo;
      E.raiseAmt.textContent = U.fmtFull(v);
      const verb = o.currentBet === 0 ? '벳' : '레이즈';
      E.btnRaise.innerHTML = allin ? `올인<small>${U.fmtFull(v)}</small>` : `${verb}<small>${U.fmtFull(v)}</small>`;
      E.btnRaise.classList.toggle('allin', allin);
    },
    askHuman(p, opt) {
      this.curOpt = opt;
      const E = this.els;
      E.bar.classList.remove('hidden');
      E.nextWrap.style.display = 'none';
      E.actionBtns.style.display = 'flex';
      const callAllIn = !opt.canCheck && opt.callAmt >= p.chips;
      E.btnCheck.innerHTML = opt.canCheck ? '체크' : (callAllIn ? `올인 콜<small>${U.fmtFull(opt.callAmt)}</small>` : `콜<small>${U.fmtFull(opt.callAmt)}</small>`);
      E.btnCheck.classList.toggle('allin', callAllIn);
      E.btnRaise.disabled = !opt.canRaise;
      E.raisePanel.classList.toggle('show', opt.canRaise);
      if (opt.canRaise) {
        E.slider.min = opt.minRaiseTo; E.slider.max = opt.maxRaiseTo; E.slider.step = Math.max(1, this.game.sb);
        // 기본값: 팟의 2/3 또는 2.5x
        const pot = opt.pot + opt.callAmt;
        let def = opt.currentBet === 0 ? Math.round(pot * 0.66) : opt.currentBet * 2.5 + opt.callAmt;
        def = U.clamp(Math.round(def / this.game.sb) * this.game.sb, opt.minRaiseTo, opt.maxRaiseTo);
        E.slider.value = def;
        U.qsa('#raise-panel .presets button').forEach((x) => x.classList.remove('on'));
        this.updateRaiseLabel();
      } else {
        E.btnRaise.innerHTML = '레이즈';
      }
      return new Promise((res) => {
        this.humanResolve = res;
        this.startTimer(p.seat, () => res && this.timeout());
      });
    },
    timeout() {
      if (!this.humanResolve) return;
      const r = this.humanResolve; this.humanResolve = null;
      this.hideActions(); this.stopTimer();
      r({ type: this.curOpt.canCheck ? 'check' : 'fold' });
    },
    hideActions() { this.els.bar.classList.add('hidden'); },
    startTimer(seat, onEnd) {
      this.stopTimer();
      if (!this.timerEnabled) return;
      const s = this.seats[seat];
      const total = this.timerSeconds || 20;
      s.ringSvg.classList.remove('warn');
      s.ring.style.transition = 'none';
      s.ring.style.strokeDashoffset = '0';
      void s.ring.getBoundingClientRect();
      s.ring.style.transition = `stroke-dashoffset ${total}s linear`;
      s.ring.style.strokeDashoffset = '100';
      let left = total;
      this.timerSeat = seat;
      this.timerHandle = setInterval(() => {
        left--;
        if (left <= 5 && left > 0) { s.ringSvg.classList.add('warn'); Sfx.tick(); }
        if (left <= 0) { this.stopTimer(); onEnd(); }
      }, 1000);
    },
    stopTimer() {
      clearInterval(this.timerHandle); this.timerHandle = null;
      if (this.timerSeat != null) {
        const s = this.seats[this.timerSeat];
        if (s) { s.ring.style.transition = 'none'; s.ring.style.strokeDashoffset = '100'; s.ringSvg.classList.remove('warn'); }
        this.timerSeat = null;
      }
    },
    /* 다음 핸드 대기 (탭으로 스킵) */
    waitNext(ms, label) {
      const E = this.els;
      E.bar.classList.remove('hidden');
      E.actionBtns.style.display = 'none';
      E.raisePanel.classList.remove('show');
      E.nextWrap.style.display = 'flex';
      const btn = E.nextWrap.querySelector('button');
      const hint = E.nextWrap.querySelector('.wait-hint');
      btn.textContent = label || '다음 핸드 ▶';
      return new Promise((res) => {
        let left = Math.ceil(ms / 1000);
        hint.textContent = left + '초 후 자동 진행';
        const iv = setInterval(() => { left--; hint.textContent = Math.max(0, left) + '초 후 자동 진행'; }, 1000);
        const done = () => { clearInterval(iv); clearTimeout(t); btn.onclick = null; E.nextWrap.style.display = 'none'; this.hideActions(); res(); };
        const t = setTimeout(done, ms);
        btn.onclick = () => { Sfx.click(); done(); };
      });
    },

    /* ---------- 모달 / 토스트 ---------- */
    modal(opts) {
      return new Promise((res) => {
        const back = U.el('div', 'modal-back');
        const m = U.el('div', 'modal' + (opts.wide ? ' wide' : ''));
        m.innerHTML = `${opts.title ? `<h2 class="${opts.grad ? 'grad' : ''}">${opts.title}</h2>` : ''}${opts.sub ? `<p class="sub">${opts.sub}</p>` : ''}<div class="modal-body">${opts.html || ''}</div>`;
        const btns = U.el('div', 'modal-btns');
        (opts.buttons || [{ label: '확인', value: true }]).forEach((b) => {
          const btn = U.el('button', 'btn ' + (b.cls || ''), b.label);
          btn.onclick = () => { Sfx.click(); close(b.value); };
          btns.appendChild(btn);
        });
        m.appendChild(btns);
        back.appendChild(m);
        const close = (v) => { back.remove(); res(v); };
        if (opts.dismiss !== false) back.addEventListener('click', (e) => { if (e.target === back) close(null); });
        U.qs('#overlays').appendChild(back);
        if (opts.onOpen) opts.onOpen(m, close);
      });
    },
    toast(text, sub, icon, cls) {
      const t = U.el('div', 'toast ' + (cls || ''));
      t.innerHTML = `<span class="t-icon">${icon || '✨'}</span><div class="t-body"><span>${text}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
      U.qs('#toasts').appendChild(t);
      setTimeout(() => t.remove(), 3300);
    },
  };
  window.UI = UI;
})();
