/* ===== 홀덤 게임 엔진 =====
 * 비동기 상태 머신. UI는 onEvent(type, data) 로 연출을 붙이고, Promise 로 진행을 제어한다.
 */
(function () {
  const HE = typeof HandEval !== 'undefined' ? HandEval : require('./evaluator.js');
  const C = typeof Cards !== 'undefined' ? Cards : require('./cards.js');

  class PokerGame {
    /**
     * opts: { players:[{id,name,chips,isHuman,ai}], sb, bb, ante, onEvent(type,data)->Promise|void,
     *         getHumanAction(player, options)->Promise<action>, getAiAction(player, options)->Promise<action>, mode }
     */
    constructor(opts) {
      this.opts = opts;
      this.players = opts.players.map((p, i) => Object.assign({
        seat: i, hand: [], folded: false, allIn: false, bet: 0, totalBet: 0, acted: false, out: false,
        lastAction: null, wonThisHand: 0,
      }, p));
      this.sb = opts.sb; this.bb = opts.bb; this.ante = opts.ante || 0;
      this.dealer = -1;
      this.handNo = 0;
      this.board = [];
      this.stage = 'idle';
      this.stopped = false;
      this.history = [];
    }

    async emit(type, data) {
      if (this.opts.onEvent) return this.opts.onEvent(type, data || {});
    }

    setBlinds(sb, bb, ante) { this.sb = sb; this.bb = bb; this.ante = ante || 0; }

    alive() { return this.players.filter((p) => !p.out && p.chips > 0); }
    inHand() { return this.players.filter((p) => !p.out && !p.folded && p.hand.length); }
    canAct() { return this.players.filter((p) => !p.out && !p.folded && !p.allIn && p.hand.length); }
    pot() { return this.players.reduce((s, p) => s + p.totalBet, 0); }

    nextSeat(idx, pred) {
      const n = this.players.length;
      for (let k = 1; k <= n; k++) {
        const j = (idx + k) % n;
        const p = this.players[j];
        if (pred ? pred(p) : (!p.out && p.hand.length && !p.folded)) return j;
      }
      return -1;
    }

    commit(p, amt) {
      amt = Math.min(amt, p.chips);
      p.chips -= amt;
      p.bet += amt;
      p.totalBet += amt;
      if (p.chips === 0) p.allIn = true;
      return amt;
    }

    /* 한 핸드 플레이. 진행 불가면 false */
    async playHand() {
      const alive = this.alive();
      if (alive.length < 2 || this.stopped) return false;
      this.handNo++;
      this.board = [];
      this.stage = 'preflop';
      this.deck = new C.Deck().shuffle();
      for (const p of this.players) {
        p.hand = []; p.folded = false; p.allIn = false; p.bet = 0; p.totalBet = 0; p.acted = false;
        p.lastAction = null; p.wonThisHand = 0; p.showCards = false; p.result = null;
        if (p.chips <= 0) p.out = true;
      }
      const isAlive = (p) => !p.out && p.chips > 0;
      this.dealer = this.nextSeat(this.dealer < 0 ? this.players.length - 1 : this.dealer, isAlive);
      const hu = alive.length === 2;
      const sbIdx = hu ? this.dealer : this.nextSeat(this.dealer, isAlive);
      const bbIdx = this.nextSeat(sbIdx, isAlive);
      this.sbIdx = sbIdx; this.bbIdx = bbIdx;

      // 카드 배분 (핸드 존재 = 참여)
      for (const p of alive) p.hand = [this.deck.draw(), this.deck.draw()];

      // 앤티
      if (this.ante > 0) for (const p of alive) this.commit(p, this.ante);
      const sbAmt = this.commit(this.players[sbIdx], this.sb);
      const bbAmt = this.commit(this.players[bbIdx], this.bb);
      this.currentBet = Math.max(this.ante > 0 ? this.bb : 0, this.bb);
      // 앤티는 bet 에 포함되지 않도록 조정
      if (this.ante > 0) for (const p of alive) p.bet -= this.ante;
      this.minRaise = this.bb;
      this.lastAggressor = bbIdx;

      await this.emit('handStart', { handNo: this.handNo, dealer: this.dealer, sbIdx, bbIdx, sb: sbAmt, bb: bbAmt, ante: this.ante });
      await this.emit('deal', { players: alive.map((p) => p.seat) });

      // 프리플랍
      let first = this.nextSeat(bbIdx);
      await this.bettingRound(first);
      await this.collectBets();

      const streets = [['flop', 3], ['turn', 1], ['river', 1]];
      for (const [name, n] of streets) {
        if (this.stopped) return false;
        if (this.inHand().length <= 1) break;
        this.stage = name;
        for (let i = 0; i < n; i++) this.board.push(this.deck.draw());
        await this.emit('street', { stage: name, board: this.board.slice(), newCards: this.board.slice(-n) });
        if (this.canAct().length >= 2) {
          this.currentBet = 0; this.minRaise = this.bb;
          await this.bettingRound(this.nextSeat(this.dealer));
          await this.collectBets();
        } else {
          await this.emit('runout', { stage: name });
        }
      }
      if (this.stopped) return false;
      await this.showdown();
      // 탈락 처리
      const busted = [];
      for (const p of this.players) {
        if (!p.out && p.chips <= 0) { busted.push(p); }
      }
      await this.emit('handEnd', { busted, handNo: this.handNo });
      return true;
    }

    async collectBets() {
      const moved = this.players.filter((p) => p.bet > 0).map((p) => ({ seat: p.seat, amount: p.bet }));
      for (const p of this.players) p.bet = 0;
      this.currentBet = 0;
      await this.emit('collect', { moved, pot: this.pot() });
    }

    options(p) {
      const callAmt = Math.min(this.currentBet - p.bet, p.chips);
      const canCheck = callAmt === 0;
      const maxTo = p.bet + p.chips;
      let minTo = this.currentBet + this.minRaise;
      if (this.currentBet === 0) minTo = this.bb;
      if (minTo > maxTo) minTo = maxTo;
      const canRaise = maxTo > this.currentBet && p.chips > callAmt;
      return {
        canCheck, callAmt, canRaise, minRaiseTo: minTo, maxRaiseTo: maxTo,
        pot: this.pot(), currentBet: this.currentBet, stage: this.stage,
        board: this.board.slice(), numOpp: this.inHand().length - 1,
        numCanAct: this.canAct().length,
      };
    }

    async bettingRound(startIdx) {
      for (const p of this.players) p.acted = false;
      let idx = startIdx;
      let guard = 0;
      while (guard++ < 200) {
        if (this.stopped) return;
        if (this.inHand().length <= 1) return;
        const actors = this.canAct();
        if (actors.length === 0) return;
        if (actors.every((p) => p.acted && p.bet === this.currentBet)) return;
        const p = this.players[idx];
        if (!p.out && !p.folded && !p.allIn && p.hand.length) {
          const opt = this.options(p);
          await this.emit('turn', { seat: p.seat, options: opt });
          let action;
          try {
            action = p.isHuman ? await this.opts.getHumanAction(p, opt) : await this.opts.getAiAction(p, opt);
          } catch (e) { console.error(e); action = { type: opt.canCheck ? 'check' : 'fold' }; }
          if (this.stopped) return;
          this.applyAction(p, action || { type: 'fold' }, opt);
          await this.emit('action', { seat: p.seat, action: p.lastAction, pot: this.pot(), options: opt });
        }
        idx = (idx + 1) % this.players.length;
      }
    }

    applyAction(p, action, opt) {
      let type = action.type;
      let amount = action.amount | 0;
      if (type === 'check' && !opt.canCheck) type = 'fold';
      if (type === 'bet') type = 'raise';
      if (type === 'allin') { type = 'raise'; amount = opt.maxRaiseTo; }
      if (type === 'raise' && !opt.canRaise) type = opt.callAmt > 0 ? 'call' : 'check';
      let res = { type, amount: 0 };
      if (type === 'fold') {
        p.folded = true;
      } else if (type === 'check') {
        // nothing
      } else if (type === 'call') {
        res.amount = this.commit(p, opt.callAmt);
      } else if (type === 'raise') {
        let to = Math.max(opt.minRaiseTo, Math.min(amount, opt.maxRaiseTo));
        if (amount >= opt.maxRaiseTo) to = opt.maxRaiseTo;
        const add = to - p.bet;
        res.amount = this.commit(p, add);
        const newTotal = p.bet;
        if (newTotal > this.currentBet) {
          const inc = newTotal - this.currentBet;
          if (inc >= this.minRaise) this.minRaise = inc;
          this.currentBet = newTotal;
          this.lastAggressor = p.seat;
          for (const q of this.players) if (q !== p) q.acted = false;
          res.type = opt.currentBet === 0 ? 'bet' : 'raise';
        } else {
          res.type = 'call';
        }
        if (p.allIn) res.allIn = true;
      }
      if (p.allIn && res.type !== 'fold') res.allIn = true;
      res.to = p.bet;
      p.acted = true;
      p.lastAction = res;
      return res;
    }

    async showdown() {
      this.stage = 'showdown';
      const contenders = this.inHand();
      const pots = [];
      // 콜되지 않은 베팅 환불
      if (contenders.length >= 1) {
        const sorted = contenders.slice().sort((a, b) => b.totalBet - a.totalBet);
        const top = sorted[0];
        const otherMax = this.players.filter((q) => q !== top).reduce((m, q) => Math.max(m, q.totalBet), 0);
        if (top.totalBet > otherMax) {
          const refund = top.totalBet - otherMax;
          top.totalBet -= refund;
          top.chips += refund;
          await this.emit('refund', { seat: top.seat, amount: refund });
        }
      }
      const totalPot = this.pot();
      if (contenders.length === 1) {
        const w = contenders[0];
        w.chips += totalPot;
        w.wonThisHand += totalPot;
        pots.push({ amount: totalPot, winners: [w.seat], eligible: [w.seat], showdown: false });
        for (const p of this.players) p.totalBet = 0;
        await this.emit('showdown', { pots, showdown: false, board: this.board.slice() });
        return;
      }
      // 평가
      for (const p of contenders) {
        const bf = HE.bestFive(p.hand.concat(this.board));
        p.result = { ev: bf.ev, best: bf.cards, name: HE.describe(bf.ev) };
        p.showCards = true;
      }
      const levels = Array.from(new Set(contenders.map((p) => p.totalBet))).sort((a, b) => a - b);
      let prev = 0;
      for (const lvl of levels) {
        let amount = 0;
        for (const p of this.players) amount += Math.max(0, Math.min(p.totalBet, lvl) - prev);
        const eligible = contenders.filter((p) => p.totalBet >= lvl);
        let best = -1;
        for (const p of eligible) if (p.result.ev.score > best) best = p.result.ev.score;
        const winners = eligible.filter((p) => p.result.ev.score === best);
        // 딜러 다음부터 순서 정렬 (홀수 칩 배분)
        winners.sort((a, b) => ((a.seat - this.dealer + this.players.length) % this.players.length) - ((b.seat - this.dealer + this.players.length) % this.players.length));
        const share = Math.floor(amount / winners.length);
        let rem = amount - share * winners.length;
        for (const w of winners) {
          let give = share + (rem > 0 ? 1 : 0);
          if (rem > 0) rem--;
          w.chips += give;
          w.wonThisHand += give;
        }
        if (amount > 0) pots.push({ amount, winners: winners.map((w) => w.seat), eligible: eligible.map((p) => p.seat), showdown: true, hand: winners[0].result.name, cat: winners[0].result.ev.cat });
        prev = lvl;
      }
      for (const p of this.players) p.totalBet = 0;
      await this.emit('showdown', { pots, showdown: true, board: this.board.slice() });
    }
  }

  if (typeof window !== 'undefined') window.PokerGame = PokerGame;
  if (typeof module !== 'undefined') module.exports = PokerGame;
})();
