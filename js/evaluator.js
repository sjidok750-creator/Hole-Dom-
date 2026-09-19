/* ===== 핸드 평가기 (5~7장 최고 조합) =====
 * score = 카테고리*15^5 + 타이브레이커 (높을수록 강함)
 */
(function () {
  const CAT_NAMES = ['하이카드', '원페어', '투페어', '트리플', '스트레이트', '플러시', '풀하우스', '포카드', '스트레이트 플러시'];
  const CAT_EN = ['High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'];
  const RANK_KO = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  function straightHigh(mask) {
    for (let hi = 12; hi >= 4; hi--) {
      if (((mask >> (hi - 4)) & 31) === 31) return hi;
    }
    if ((mask & 0x100f) === 0x100f) return 3; // A-2-3-4-5 (5 high)
    return -1;
  }

  function topRanks(mask, n, exclude) {
    const out = [];
    for (let r = 12; r >= 0 && out.length < n; r--) {
      if ((mask >> r) & 1) {
        if (exclude && exclude.indexOf(r) >= 0) continue;
        out.push(r);
      }
    }
    return out;
  }

  function pack(cat, tb) {
    let s = cat;
    for (let i = 0; i < 5; i++) s = s * 15 + (tb[i] != null ? tb[i] + 1 : 0);
    return s;
  }

  function evaluate(cards) {
    const rankCount = new Array(13).fill(0);
    const suitCount = [0, 0, 0, 0];
    const suitMask = [0, 0, 0, 0];
    let rankMask = 0;
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const r = c % 13, s = (c / 13) | 0;
      rankCount[r]++;
      suitCount[s]++;
      suitMask[s] |= 1 << r;
      rankMask |= 1 << r;
    }
    let flushSuit = -1;
    for (let s = 0; s < 4; s++) if (suitCount[s] >= 5) flushSuit = s;
    if (flushSuit >= 0) {
      const sf = straightHigh(suitMask[flushSuit]);
      if (sf >= 0) return { cat: 8, tb: [sf], score: pack(8, [sf]) };
    }
    const quads = [], trips = [], pairs = [];
    for (let r = 12; r >= 0; r--) {
      if (rankCount[r] === 4) quads.push(r);
      else if (rankCount[r] === 3) trips.push(r);
      else if (rankCount[r] === 2) pairs.push(r);
    }
    if (quads.length) {
      const k = topRanks(rankMask, 1, quads);
      const tb = [quads[0], k[0]];
      return { cat: 7, tb, score: pack(7, tb) };
    }
    if (trips.length && (pairs.length || trips.length > 1)) {
      const t = trips[0];
      const p = trips.length > 1 ? Math.max(trips[1], pairs.length ? pairs[0] : -1) : pairs[0];
      const tb = [t, p];
      return { cat: 6, tb, score: pack(6, tb) };
    }
    if (flushSuit >= 0) {
      const tb = topRanks(suitMask[flushSuit], 5);
      return { cat: 5, tb, score: pack(5, tb) };
    }
    const st = straightHigh(rankMask);
    if (st >= 0) return { cat: 4, tb: [st], score: pack(4, [st]) };
    if (trips.length) {
      const k = topRanks(rankMask, 2, trips);
      const tb = [trips[0], k[0], k[1]];
      return { cat: 3, tb, score: pack(3, tb) };
    }
    if (pairs.length >= 2) {
      const p1 = pairs[0], p2 = pairs[1];
      const rest = topRanks(rankMask, 1, [p1, p2]);
      const tb = [p1, p2, rest[0]];
      return { cat: 2, tb, score: pack(2, tb) };
    }
    if (pairs.length === 1) {
      const k = topRanks(rankMask, 3, pairs);
      const tb = [pairs[0], k[0], k[1], k[2]];
      return { cat: 1, tb, score: pack(1, tb) };
    }
    const tb = topRanks(rankMask, 5);
    return { cat: 0, tb, score: pack(0, tb) };
  }

  function describe(ev) {
    const c = ev.cat, t = ev.tb;
    const R = (r) => RANK_KO[r];
    switch (c) {
      case 8: return t[0] === 12 ? '로열 플러시' : R(t[0]) + ' 하이 스트레이트 플러시';
      case 7: return R(t[0]) + ' 포카드';
      case 6: return R(t[0]) + ' 풀하우스 (' + R(t[1]) + ')';
      case 5: return R(t[0]) + ' 하이 플러시';
      case 4: return R(t[0]) + ' 하이 스트레이트';
      case 3: return R(t[0]) + ' 트리플';
      case 2: return R(t[0]) + '·' + R(t[1]) + ' 투페어';
      case 1: return R(t[0]) + ' 원페어';
      default: return R(t[0]) + ' 하이카드';
    }
  }

  /* 7장 중 최고 5장 (하이라이트용) */
  function bestFive(cards) {
    if (cards.length <= 5) return { cards: cards.slice(), ev: evaluate(cards) };
    let best = null, bestSet = null;
    const n = cards.length;
    const idx = [0, 1, 2, 3, 4];
    const combo = (start, depth, chosen) => {
      if (depth === 5) {
        const ev = evaluate(chosen);
        if (!best || ev.score > best.score) { best = ev; bestSet = chosen.slice(); }
        return;
      }
      for (let i = start; i <= n - (5 - depth); i++) {
        chosen.push(cards[i]);
        combo(i + 1, depth + 1, chosen);
        chosen.pop();
      }
    };
    combo(0, 0, []);
    return { cards: bestSet, ev: best };
  }

  /* 몬테카를로 에퀴티 (승률 추정) */
  function equity(hole, board, numOpp, iters) {
    const known = new Set(hole.concat(board));
    const pool = [];
    for (let c = 0; c < 52; c++) if (!known.has(c)) pool.push(c);
    const need = 5 - board.length;
    let wins = 0, ties = 0;
    const poolLen = pool.length;
    for (let it = 0; it < iters; it++) {
      // 부분 셔플
      const take = need + numOpp * 2;
      for (let i = 0; i < take; i++) {
        const j = i + Math.floor(Math.random() * (poolLen - i));
        const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
      const fullBoard = board.slice();
      for (let i = 0; i < need; i++) fullBoard.push(pool[i]);
      const my = evaluate(hole.concat(fullBoard)).score;
      let best = -1, bestCount = 0;
      for (let o = 0; o < numOpp; o++) {
        const oc = [pool[need + o * 2], pool[need + o * 2 + 1]];
        const s = evaluate(oc.concat(fullBoard)).score;
        if (s > best) { best = s; bestCount = 1; } else if (s === best) bestCount++;
      }
      if (my > best) wins++;
      else if (my === best) ties += 1 / (bestCount + 1);
    }
    return (wins + ties) / iters;
  }

  const HandEval = { evaluate, describe, bestFive, equity, CAT_NAMES, CAT_EN };
  if (typeof window !== 'undefined') window.HandEval = HandEval;
  if (typeof module !== 'undefined') module.exports = HandEval;
})();
