/* node tests/evaluator.test.js */
const Cards = require('../js/cards.js');
const HandEval = require('../js/evaluator.js');
const P = (s) => s.split(' ').map(Cards.parse);
let pass = 0, fail = 0;
function eq(name, a, b) {
  if (a === b) pass++; else { fail++; console.error('FAIL', name, a, b); }
}
function cat(s) { return HandEval.evaluate(P(s)).cat; }
function gt(name, a, b) {
  const sa = HandEval.evaluate(P(a)).score, sb = HandEval.evaluate(P(b)).score;
  if (sa > sb) pass++; else { fail++; console.error('FAIL', name, a, sa, 'should beat', b, sb); }
}
function same(name, a, b) {
  const sa = HandEval.evaluate(P(a)).score, sb = HandEval.evaluate(P(b)).score;
  if (sa === sb) pass++; else { fail++; console.error('FAIL', name, a, sa, 'should tie', b, sb); }
}
eq('royal', cat('As Ks Qs Js Ts 2d 3c'), 8);
eq('straight flush wheel', cat('As 2s 3s 4s 5s Kd Kc'), 8);
eq('quads', cat('9s 9h 9d 9c 2s 3d 4c'), 7);
eq('full house', cat('9s 9h 9d Ac Ad 3d 4c'), 6);
eq('flush', cat('2s 9s Ks 5s 7s Ad Ac'), 5);
eq('straight', cat('5s 6h 7d 8c 9s Ad Ac'), 4);
eq('wheel', cat('As 2h 3d 4c 5s Kd Kc'), 4);
eq('trips', cat('7s 7h 7d Ac Kd 3d 4c'), 3);
eq('two pair', cat('7s 7h Kd Ac Kc 3d 4c'), 2);
eq('pair', cat('7s 7h Qd Ac Kc 3d 4c'), 1);
eq('high', cat('7s 2h Qd Ac Kc 3d 9c'), 0);
eq('not straight (gap)', cat('2s 3h 4d 5c 7s 9d Jc'), 0);
eq('flush over straight', cat('5s 6s 7s 8s 9d Ts 2c'), 5);
eq('straight flush in 7', cat('5s 6s 7s 8s 9s Ts 2c'), 8);
gt('quads kicker', '9s 9h 9d 9c As 3d 4c', '9s 9h 9d 9c Ks 3d 4c');
gt('full house trips rank', 'Ts Th Td 2c 2d 3d 4c', '9s 9h 9d Ac Ad 3d 4c');
gt('two trips -> best full house', 'As Ah Ad Kc Kd Kh 2c', 'As Ah Ad Qc Qd Qh 2c');
gt('flush high', 'As 9s Ks 5s 7s 2d 3c', 'Qs 9s Ks 5s 7s 2d 3c');
gt('straight high', '6s 7h 8d 9c Ts 2d 3c', '5s 6h 7d 8c 9s 2d 3c');
gt('broadway beats wheel', 'As Kh Qd Jc Ts 2d 3c', 'As 2h 3d 4c 5s 8d 9c');
gt('two pair top', 'As Ah Kd Kc 2s 3d 4c', 'As Ah Qd Qc 2s 3d 4c');
gt('two pair kicker', 'As Ah Kd Kc Qs 3d 4c', 'As Ah Kd Kc Js 3d 4c');
gt('three pairs pick top two + kicker', 'As Ah Kd Kc Qs Qd 2c', 'As Ah Kd Kc Js Jd 2c');
gt('pair kicker', 'As Ah Kd Qc 9s 3d 4c', 'As Ah Kd Jc 9s 3d 4c');
gt('high card', 'As Kh Qd Jc 9s 3d 4c', 'As Kh Qd Jc 8s 3d 4c');
same('board plays', '2s 3h As Kh Qd Jc Ts', '4s 5h As Kh Qd Jc Ts');
same('same two pair kicker on board', 'As Ah Kd Kc Qs 3d 4c', 'Ad Ac Kh Ks Qd 5d 6c');
gt('pair beats high', '2s 2h 3d 5c 7s 9d Jc', 'As Kh Qd Jc 9s 3d 4c');
// bestFive
const bf = HandEval.bestFive(P('As Ks Qs Js Ts 2d 3c'));
eq('bestFive royal count', bf.cards.length, 5);
eq('bestFive royal cat', bf.ev.cat, 8);
// equity sanity
const eqAA = HandEval.equity(P('As Ah'), [], 1, 3000);
const eq72 = HandEval.equity(P('7s 2h'), [], 1, 3000);
if (eqAA > 0.8 && eqAA < 0.9) pass++; else { fail++; console.error('FAIL AA equity', eqAA); }
if (eq72 < 0.42) pass++; else { fail++; console.error('FAIL 72o equity', eq72); }
// describe
eq('describe royal', HandEval.describe(HandEval.evaluate(P('As Ks Qs Js Ts 2d 3c'))), '로열 플러시');
console.log(`evaluator: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
