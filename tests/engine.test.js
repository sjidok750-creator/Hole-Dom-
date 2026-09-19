/* node tests/engine.test.js — 엔진 시뮬레이션 (칩 보존, 사이드팟, 종료) */
const PokerGame = require('../js/engine.js');
const AI = require('../js/ai.js');
let fail = 0, pass = 0;
function check(name, cond, extra) { if (cond) pass++; else { fail++; console.error('FAIL', name, extra || ''); } }

async function simulate(n, hands, seed) {
  const players = [];
  for (let i = 0; i < n; i++) players.push({ id: 'p' + i, name: 'P' + i, chips: 1000 + i * 250, isHuman: false, ai: AI.PERSONAS[i % AI.PERSONAS.length] });
  const total = players.reduce((s, p) => s + p.chips, 0);
  let events = 0;
  const game = new PokerGame({
    players, sb: 25, bb: 50, ante: 0,
    onEvent: async (t, d) => {
      events++;
      if (t === 'action') {
        const p = game.players[d.seat];
        check('chips nonneg', p.chips >= 0, p.chips);
      }
    },
    getAiAction: async (p, opt) => AI.decide(p, opt, { bb: game.bb, inPosition: p.seat === game.dealer, tournament: true }),
    getHumanAction: async () => ({ type: 'fold' }),
  });
  for (let h = 0; h < hands; h++) {
    const ok = await game.playHand();
    const sum = game.players.reduce((s, p) => s + p.chips, 0);
    check('chip conservation hand ' + h, sum === total, sum + ' vs ' + total);
    for (const p of game.players) { check('no negative', p.chips >= 0); check('bets cleared', p.totalBet === 0); }
    if (!ok) break;
    if (game.alive().length < 2) break;
  }
  return game;
}

(async () => {
  // 사이드팟 수동 검증: 3명, 한 명 숏스택 올인
  {
    const players = [
      { id: 'a', name: 'A', chips: 100, isHuman: false },
      { id: 'b', name: 'B', chips: 1000, isHuman: false },
      { id: 'c', name: 'C', chips: 1000, isHuman: false },
    ];
    const script = { a: [{ type: 'allin' }], b: [{ type: 'raise', amount: 300 }, { type: 'check' }, { type: 'check' }, { type: 'check' }], c: [{ type: 'call' }, { type: 'check' }, { type: 'check' }, { type: 'check' }] };
    let sd = null;
    const game = new PokerGame({
      players, sb: 10, bb: 20,
      onEvent: async (t, d) => { if (t === 'showdown') sd = d; },
      getAiAction: async (p) => script[p.id].shift() || { type: 'check' },
      getHumanAction: async () => ({ type: 'fold' }),
    });
    await game.playHand();
    check('side pot count', sd.pots.length === 2, JSON.stringify(sd.pots));
    check('main pot 300', sd.pots[0].amount === 300, sd.pots[0].amount);
    check('side pot 400', sd.pots[1].amount === 400, sd.pots[1].amount);
    check('side pot eligible excludes A', !sd.pots[1].eligible.includes(0));
    const sum = game.players.reduce((s, p) => s + p.chips, 0);
    check('conservation', sum === 2100, sum);
  }
  // 환불 검증: 올인에 아무도 콜 안함
  {
    const players = [
      { id: 'a', name: 'A', chips: 500, isHuman: false },
      { id: 'b', name: 'B', chips: 500, isHuman: false },
    ];
    const script = { a: [{ type: 'allin' }], b: [{ type: 'fold' }] };
    let refund = null;
    const game = new PokerGame({
      players, sb: 10, bb: 20,
      onEvent: async (t, d) => { if (t === 'refund') refund = d; },
      getAiAction: async (p) => script[p.id].shift() || { type: 'fold' },
      getHumanAction: async () => ({ type: 'fold' }),
    });
    await game.playHand();
    // dealer=seat0(A)=SB in HU. A allin 500 (bet 500), B(BB 20) folds → refund 480, A wins 40
    check('refund 480', refund && refund.amount === 480, refund && refund.amount);
    check('A chips 520', game.players[0].chips === 520, game.players[0].chips);
    check('B chips 480', game.players[1].chips === 480, game.players[1].chips);
  }
  for (const n of [2, 3, 6, 9]) {
    const g = await simulate(n, 150);
    check('finished or alive', g.alive().length >= 1);
  }
  console.log(`engine: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
