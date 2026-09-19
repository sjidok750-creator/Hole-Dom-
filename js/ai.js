/* ===== AI 플레이어 =====
 * 성향(aggr, loose, bluff)과 핸드 에퀴티(몬테카를로)를 기반으로 판단.
 */
(function () {
  const HE = typeof HandEval !== 'undefined' ? HandEval : require('./evaluator.js');
  const C = typeof Cards !== 'undefined' ? Cards : require('./cards.js');

  const PERSONAS = [
    { key: 'shark', name: '샤크', emoji: '🦈', aggr: 0.75, loose: 0.35, bluff: 0.25, desc: '냉철한 프로. 압박이 강하다.' },
    { key: 'fox', name: '폭스', emoji: '🦊', aggr: 0.55, loose: 0.5, bluff: 0.4, desc: '교활한 블러퍼.' },
    { key: 'tiger', name: '타이거', emoji: '🐯', aggr: 0.9, loose: 0.7, bluff: 0.3, desc: '거친 매니악. 올인을 즐긴다.' },
    { key: 'panda', name: '판다', emoji: '🐼', aggr: 0.3, loose: 0.6, bluff: 0.1, desc: '느긋한 콜링 스테이션.' },
    { key: 'owl', name: '아울', emoji: '🦉', aggr: 0.45, loose: 0.25, bluff: 0.15, desc: '타이트하고 신중하다.' },
    { key: 'wolf', name: '울프', emoji: '🐺', aggr: 0.65, loose: 0.45, bluff: 0.3, desc: '균형 잡힌 승부사.' },
    { key: 'dragon', name: '드래곤', emoji: '🐉', aggr: 0.8, loose: 0.4, bluff: 0.35, desc: '전설의 하이롤러.' },
    { key: 'frog', name: '프로그', emoji: '🐸', aggr: 0.35, loose: 0.8, bluff: 0.2, desc: '아무 카드나 본다.' },
    { key: 'eagle', name: '이글', emoji: '🦅', aggr: 0.6, loose: 0.3, bluff: 0.2, desc: '포지션 플레이의 달인.' },
    { key: 'cat', name: '캣', emoji: '🐱', aggr: 0.5, loose: 0.55, bluff: 0.45, desc: '변덕스러운 블러퍼.' },
    { key: 'bear', name: '베어', emoji: '🐻', aggr: 0.7, loose: 0.5, bluff: 0.2, desc: '묵직한 밸류 벳.' },
    { key: 'robot', name: '유닛-7', emoji: '🤖', aggr: 0.6, loose: 0.4, bluff: 0.25, desc: '계산된 플레이.' },
  ];

  /* Chen 공식 기반 프리플랍 강도 0~1 */
  function preflopStrength(hole) {
    const r1 = C.rank(hole[0]), r2 = C.rank(hole[1]);
    const hi = Math.max(r1, r2), lo = Math.min(r1, r2);
    const pts = (r) => (r === 12 ? 10 : r === 11 ? 8 : r === 10 ? 7 : r === 9 ? 6 : (r + 2) / 2);
    let s = pts(hi);
    if (hi === lo) s = Math.max(5, s * 2);
    else {
      if (C.suit(hole[0]) === C.suit(hole[1])) s += 2;
      const gap = hi - lo - 1;
      if (gap === 1) s -= 1; else if (gap === 2) s -= 2; else if (gap === 3) s -= 4; else if (gap >= 4) s -= 5;
      if (gap <= 1 && hi < 10) s += 1;
    }
    return Math.max(0, Math.min(1, (s + 2) / 22));
  }

  let mcIters = 120;
  const AI = {
    PERSONAS,
    preflopStrength,
    setQuality(tier) { mcIters = tier === 'low' ? 60 : tier === 'medium' ? 100 : 160; },

    /* 성향 객체 생성 */
    persona(key) {
      const p = PERSONAS.find((x) => x.key === key) || PERSONAS[0];
      return Object.assign({}, p);
    },

    decide(p, opt, ctx) {
      const ai = p.ai || PERSONAS[0];
      const hole = p.hand;
      const board = opt.board;
      const numOpp = Math.max(1, opt.numOpp);
      const pot = opt.pot;
      const callAmt = opt.callAmt;
      const bb = ctx.bb;
      const stackBB = (p.chips + p.bet) / bb;

      let strength;
      if (board.length === 0) {
        strength = preflopStrength(hole);
      } else {
        strength = HE.equity(hole, board, Math.min(numOpp, 3), mcIters);
        // 상대가 많을수록 에퀴티는 이미 낮아짐 → 보정 없음
      }
      // 무작위 잡음 (예측 불가능성)
      strength += (Math.random() - 0.5) * 0.08;
      strength = Math.max(0, Math.min(1, strength));

      const potOdds = callAmt > 0 ? callAmt / (pot + callAmt) : 0;
      const inPosition = ctx.inPosition;
      const bluffRoll = Math.random() < ai.bluff * (inPosition ? 0.22 : 0.12) * (board.length ? 1 : 0.6);
      const aggrRoll = Math.random() < ai.aggr;
      const facingBig = callAmt > pot * 0.6;

      const raiseTo = (mult) => {
        const base = opt.currentBet > 0 ? opt.currentBet * mult + (pot - opt.currentBet) * 0.15 : pot * mult;
        const to = Math.max(opt.minRaiseTo, Math.round(base / (bb / 2)) * (bb / 2));
        return Math.min(opt.maxRaiseTo, to);
      };
      const allin = () => ({ type: 'raise', amount: opt.maxRaiseTo });

      // 숏스택: 푸시/폴드
      if (ctx.tournament && stackBB <= 9 && board.length === 0) {
        const thr = 0.42 - (10 - stackBB) * 0.012 - ai.loose * 0.06;
        if (strength > thr && (opt.canRaise || callAmt > 0)) return opt.canRaise ? allin() : { type: 'call' };
        return opt.canCheck ? { type: 'check' } : { type: 'fold' };
      }

      // 프리플랍
      if (board.length === 0) {
        const openThr = 0.48 - ai.loose * 0.14 + (inPosition ? -0.04 : 0.03);
        const callThr = 0.36 - ai.loose * 0.12;
        const threeBetThr = 0.66 - ai.aggr * 0.08;
        const noRaiseYet = opt.currentBet <= bb;
        if (noRaiseYet) {
          if (strength > openThr || (bluffRoll && opt.canRaise)) {
            if (opt.canRaise && (aggrRoll || strength > openThr + 0.1)) return { type: 'raise', amount: raiseTo(2.5 + ai.aggr) };
            return callAmt > 0 ? { type: 'call' } : { type: 'check' };
          }
          if (opt.canCheck) return { type: 'check' };
          if (strength > callThr && callAmt <= bb) return { type: 'call' };
          return { type: 'fold' };
        }
        // 레이즈에 직면
        if (strength > threeBetThr && opt.canRaise && aggrRoll) return { type: 'raise', amount: raiseTo(2.6) };
        if (strength > 0.82 && opt.canRaise) return { type: 'raise', amount: raiseTo(3) };
        if (facingBig) {
          if (strength > 0.72) return { type: 'call' };
          if (strength > 0.6 && ai.loose > 0.5 && callAmt < p.chips * 0.25) return { type: 'call' };
          return { type: 'fold' };
        }
        if (strength > callThr + 0.08 || (strength > callThr && callAmt < p.chips * 0.1)) return { type: 'call' };
        if (bluffRoll && opt.canRaise && stackBB > 25) return { type: 'raise', amount: raiseTo(2.8) };
        return { type: 'fold' };
      }

      // 포스트플랍
      const betThr = 0.56 - ai.aggr * 0.14;
      const raiseThr = 0.74 - ai.aggr * 0.08;
      const valueSize = () => {
        const r = Math.random();
        const mult = r < 0.3 ? 0.45 : r < 0.75 ? 0.66 : 1.0;
        return raiseTo(mult);
      };
      if (opt.canCheck) {
        if (strength > 0.9 && opt.canRaise && Math.random() < 0.85) return { type: 'raise', amount: Math.random() < 0.2 ? opt.maxRaiseTo : valueSize() };
        if (strength > betThr && opt.canRaise && (aggrRoll || strength > betThr + 0.15)) return { type: 'raise', amount: valueSize() };
        if (bluffRoll && opt.canRaise) return { type: 'raise', amount: raiseTo(0.55) };
        return { type: 'check' };
      }
      // 베팅에 직면
      if (strength > 0.92 && opt.canRaise) return Math.random() < 0.55 ? { type: 'raise', amount: raiseTo(2.4) } : { type: 'call' };
      if (strength > raiseThr && opt.canRaise && aggrRoll) return { type: 'raise', amount: raiseTo(2.2) };
      const margin = (ai.loose - 0.5) * 0.1;
      if (strength > potOdds + 0.06 - margin) return { type: 'call' };
      if (strength > potOdds - 0.02 && callAmt < p.chips * 0.12 && Math.random() < ai.loose) return { type: 'call' };
      if (bluffRoll && opt.canRaise && !facingBig && Math.random() < 0.5) return { type: 'raise', amount: raiseTo(2.5) };
      return { type: 'fold' };
    },
  };

  if (typeof window !== 'undefined') window.AI = AI;
  if (typeof module !== 'undefined') module.exports = AI;
})();
