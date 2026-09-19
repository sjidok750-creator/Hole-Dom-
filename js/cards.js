/* ===== 카드 / 덱 =====
 * 카드는 0~51 정수. rank = c % 13 (0=2 … 12=A), suit = floor(c/13) (0=♠ 1=♥ 2=♦ 3=♣)
 */
(function () {
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const RANK_KO = ['2', '3', '4', '5', '6', '7', '8', '9', '10', '잭', '퀸', '킹', '에이스'];
  const SUITS = ['♠', '♥', '♦', '♣'];
  const SUIT_NAMES = ['spade', 'heart', 'diamond', 'club'];

  const Cards = {
    RANKS, SUITS, SUIT_NAMES, RANK_KO,
    rank: (c) => c % 13,
    suit: (c) => (c / 13) | 0,
    make: (rank, suit) => suit * 13 + rank,
    rankChar: (c) => RANKS[c % 13],
    suitChar: (c) => SUITS[(c / 13) | 0],
    str: (c) => RANKS[c % 13] + SUITS[(c / 13) | 0],
    parse: (s) => {
      // "As", "Td", "9h", "2c"
      const r = s[0] === 'T' ? 8 : RANKS.indexOf(s[0] === '1' ? '10' : s[0].toUpperCase());
      const su = 'shdc'.indexOf(s[s.length - 1].toLowerCase());
      return su * 13 + r;
    },
  };

  class Deck {
    constructor() {
      this.cards = [];
      for (let i = 0; i < 52; i++) this.cards.push(i);
      this.pos = 0;
    }
    shuffle() {
      const a = this.cards;
      // crypto 기반 셔플 (가능한 경우)
      let rnd;
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const buf = new Uint32Array(64);
        crypto.getRandomValues(buf);
        let k = 0;
        rnd = () => buf[k++ % 64] / 4294967296;
      } else rnd = Math.random;
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      this.pos = 0;
      return this;
    }
    draw() { return this.cards[this.pos++]; }
    remaining() { return 52 - this.pos; }
  }
  Cards.Deck = Deck;

  if (typeof window !== 'undefined') window.Cards = Cards;
  if (typeof module !== 'undefined') module.exports = Cards;
})();
