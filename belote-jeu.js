"use strict";
/* =========================================================
   BELOTE À QUATRE — Méli-Méninges
   Joueurs : 0 = Vous (en bas), 1 = Marcel (à droite), 2 = Simone (en face, votre partenaire), 3 = Albert (à gauche).
   Équipes : 0 = Vous + Simone (« Nous »), 1 = Marcel + Albert (« Eux »).
   Cartes : {s:'S'|'H'|'D'|'C', r:'7','8','9','10','V','D','R','A'} — images du vrai jeu français (dossier tarot-cartes).
   ========================================================= */
const $ = id => document.getElementById(id);
const NAMES = ['Vous', 'Marcel', 'Simone', 'Albert'];
const WHERE = ['', 'à votre droite', 'en face, votre partenaire', 'à votre gauche'];
const SUITS = ['S', 'H', 'C', 'D'];
const SUIT_NAME = { S: 'Pique', H: 'Cœur', D: 'Carreau', C: 'Trèfle' };
const SUIT_SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RED = { H: 1, D: 1 };
const RANKS = ['7', '8', '9', '10', 'V', 'D', 'R', 'A'];
const ORDER = ['7', '8', '9', 'V', 'D', 'R', '10', 'A'];          // couleur ordinaire
const T_ORDER = ['7', '8', 'D', 'R', '10', 'A', '9', 'V'];        // à l'atout
const VAL = { A: 11, '10': 10, R: 4, D: 3, V: 2, '9': 0, '8': 0, '7': 0 };
const T_VAL = { V: 20, '9': 14, A: 11, '10': 10, R: 4, D: 3, '8': 0, '7': 0 };
const RNAME = { A: 'As', V: 'Valet', D: 'Dame', R: 'Roi' };
const team = p => p % 2;
const partner = p => (p + 2) % 4;
const same = (a, b) => a.s === b.s && a.r === b.r;
const suitHTML = s => `<span class="sym${RED[s] ? ' r' : ''}">${SUIT_SYM[s]}</span>`;

let G = null, timer = null;
const wait = (ms, fn) => { clearTimeout(timer); timer = setTimeout(fn, ms); };
let totals = [0, 0], history = [], dealer = 3, pending = 0, pendingTeam = -1;
try { const s = JSON.parse(localStorage.getItem('mm-belote') || 'null'); if (s) { totals = s.totals; history = s.history || []; dealer = s.dealer ?? 3; } } catch (e) {}
const save = () => { try { localStorage.setItem('mm-belote', JSON.stringify({ totals, history: history.slice(-30), dealer })); } catch (e) {} };

const value = c => G && c.s === G.atout ? T_VAL[c.r] : VAL[c.r];
const rankOf = c => (G && c.s === G.atout ? T_ORDER : ORDER).indexOf(c.r);
function cardName(c) {
  const r = RNAME[c.r] || c.r;
  return (c.r === 'A' ? "l'As" : 'le ' + r) + ' de ' + SUIT_NAME[c.s].toLowerCase() + (G && c.s === G.atout ? ' (atout)' : '');
}
const capital = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- cartes (images du vrai jeu) ---------- */
const FILE_R = { A: 1, V: 11, D: 13, R: 14 };
const imgFile = c => 'tarot-cartes/' + (c ? c.s + (FILE_R[c.r] || c.r) : 'dos') + '.webp';
function cardEl(c, tag = 'span') {
  const el = document.createElement(tag);
  el.className = 'card';
  const im = document.createElement('img');
  im.src = imgFile(c); im.alt = ''; im.draggable = false; im.decoding = 'async';
  el.append(im);
  if (c) { el.setAttribute('aria-label', capital(cardName(c))); el.title = capital(cardName(c)); }
  if (tag === 'span' && c) el.setAttribute('role', 'img');
  return el;
}
(() => { const all = [null]; for (const s of SUITS) for (const r of RANKS) all.push({ s, r }); all.forEach(c => { const i = new Image(); i.src = imgFile(c); }); })();

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function sortHand(h) {
  // atout à droite, couleurs alternées rouge/noir
  const suits = SUITS.filter(s => s !== G.atout); if (G.atout) suits.push(G.atout);
  h.sort((a, b) => suits.indexOf(a.s) - suits.indexOf(b.s) || rankOf(a) - rankOf(b));
}

/* =========================================================
   DONNE ET ENCHÈRES
   ========================================================= */
function newDeal() {
  clearTimeout(timer); closeSheet();
  if (totals[0] >= 1000 || totals[1] >= 1000) { totals = [0, 0]; history = []; }
  dealer = (dealer + 1) % 4; save();
  played.length = 0;
  const deck = shuffle(SUITS.flatMap(s => RANKS.map(r => ({ s, r }))));
  const hands = [[], [], [], []];
  for (let k = 0; k < 4; k++) { const p = (dealer + 1 + k) % 4; hands[p].push(...deck.splice(0, 5)); }
  const turned = deck.shift();
  G = { hands, rest: deck, turned, atout: null, taker: -1, round: 1, phase: 'bid', turn: (dealer + 1) % 4, bids: [null, null, null, null],
        trick: [], leader: (dealer + 1) % 4, tricks: [0, 0], won: [[], []], last: null, belote: -1, beloteSaid: 0, say: {}, hint: null, msg: '' };
  hands.forEach(sortHand);
  G.msg = (dealer === 0 ? 'Vous distribuez' : NAMES[dealer] + ' distribue') + `. La carte retournée est ${cardName(turned)}.`;
  render();
  wait(900, bidStep);
}
function bidScore(h, s, withTurned) {
  const cards = withTurned ? [...h, G.turned] : h;
  const tr = cards.filter(c => c.s === s);
  let sc = tr.length * 1.2;
  if (tr.some(c => c.r === 'V')) sc += 3.5;
  if (tr.some(c => c.r === '9')) sc += 2.2;
  if (tr.some(c => c.r === 'A')) sc += 1;
  if (tr.some(c => c.r === 'R') && tr.some(c => c.r === 'D')) sc += 1;
  sc += cards.filter(c => c.s !== s && c.r === 'A').length * 1.3;
  sc += cards.filter(c => c.s !== s && c.r === '10').length * .4;
  // le partenaire du donneur profite aussi de la carte retournée : on reste prudent sans elle
  return sc;
}
function botBid(p) {
  const h = G.hands[p];
  if (G.round === 1) return bidScore(h, G.turned.s, true) >= 8.2 ? G.turned.s : null;
  let best = null, bs = 0;
  for (const s of SUITS) if (s !== G.turned.s) { const v = bidScore(h, s, false); if (v > bs) { bs = v; best = s; } }
  return bs >= 8.4 ? best : null;
}
function bidStep() {
  if (G.phase !== 'bid') return;
  const p = G.turn;
  if (p === 0) { setTimeout(showHand, 50); G.msg = G.round === 1 ? `À vous : prenez-vous à ${SUIT_NAME[G.turned.s]} (la carte retournée) ?` : 'Deuxième tour : choisissez une autre couleur d’atout, ou passez.'; render(); return; }
  G.msg = NAMES[p] + ' réfléchit…'; render();
  wait(900, () => doBid(p, botBid(p)));
}
function doBid(p, s) {
  G.bids[p] = s || 'pass';
  if (s) {
    G.atout = s; G.taker = p; G.phase = 'take';
    G.msg = (p === 0 ? 'Vous prenez' : NAMES[p] + ' prend') + ` à ${SUIT_NAME[s]} ${SUIT_SYM[s]}.`;
    render();
    return wait(1500, distribute);
  }
  G.turn = (p + 1) % 4;
  if (G.turn === (dealer + 1) % 4) {
    if (G.round === 1) { G.round = 2; G.bids = [null, null, null, null]; G.msg = 'Personne n’a pris : deuxième tour, chacun peut choisir une autre couleur.'; render(); return wait(1400, bidStep); }
    G.phase = 'allpass'; G.msg = 'Personne n’a pris : on redistribue.'; render(); return;
  }
  render(); wait(500, bidStep);
}
function distribute() {
  const t = G.taker;
  G.hands[t].push(G.turned, ...G.rest.splice(0, 2));
  for (let k = 0; k < 4; k++) { const p = (dealer + 1 + k) % 4; if (p !== t) G.hands[p].push(...G.rest.splice(0, 3)); }
  G.hands.forEach(sortHand);
  G.belote = G.hands.findIndex(h => h.some(c => c.s === G.atout && c.r === 'R') && h.some(c => c.s === G.atout && c.r === 'D'));
  G.phase = 'play'; G.turn = G.leader; G.trick = [];
  G.msg = 'Chacun a ses 8 cartes. ' + (G.turn === 0 ? 'À vous d’entamer.' : NAMES[G.turn] + ' entame.');
  render(); playStep();
}

/* =========================================================
   JEU DE LA CARTE
   ========================================================= */
function trickWinner(trick) {
  const L = trick[0].c.s;
  const str = c => c.s === G.atout ? 100 + T_ORDER.indexOf(c.r) : c.s === L ? ORDER.indexOf(c.r) : -1;
  return trick.reduce((b, x) => str(x.c) > str(b.c) ? x : b, trick[0]);
}
function legalCards(h, trick, p) {
  if (!trick.length) return h.slice();
  const L = trick[0].c.s, A = G.atout;
  const tr = h.filter(c => c.s === A);
  const highT = Math.max(-1, ...trick.filter(x => x.c.s === A).map(x => T_ORDER.indexOf(x.c.r)));
  const over = tr.filter(c => T_ORDER.indexOf(c.r) > highT);
  if (L === A) return tr.length ? (over.length ? over : tr) : h.slice();
  const follow = h.filter(c => c.s === L);
  if (follow.length) return follow;
  if (team(trickWinner(trick).p) === team(p)) return h.slice();          // partenaire maître : on joue ce qu'on veut
  if (!tr.length) return h.slice();
  return over.length ? over : tr;                                          // couper, surcouper, ou sous-couper si l'on ne peut pas monter
}
function whyRule(h, trick) {
  if (!trick.length) return 'Vous entamez : jouez la carte de votre choix.';
  const L = trick[0].c.s, A = G.atout, nm = SUIT_NAME[L];
  const highT = Math.max(-1, ...trick.filter(x => x.c.s === A).map(x => T_ORDER.indexOf(x.c.r)));
  const canOver = h.some(c => c.s === A && T_ORDER.indexOf(c.r) > highT);
  if (L === A) {
    if (!h.some(c => c.s === A)) return 'Atout demandé, vous n’en avez plus : défaussez la carte de votre choix.';
    return canOver ? 'Atout demandé : vous devez monter plus fort.' : 'Atout demandé : jouez un atout (vous ne pouvez pas monter).';
  }
  if (h.some(c => c.s === L)) return `Il faut fournir à ${nm} ${SUIT_SYM[L]}.`;
  if (team(trickWinner(trick).p) === 0) return `Pas de ${nm}, mais votre partenaire est maître : jouez ce que vous voulez.`;
  if (!h.some(c => c.s === A)) return `Pas de ${nm} ni d’atout : défaussez la carte de votre choix.`;
  return canOver ? `Pas de ${nm} : vous devez couper à l’atout ${SUIT_SYM[A]}${highT >= 0 ? ' plus fort' : ''}.` : `Pas de ${nm} : vous devez jouer un atout, même plus faible.`;
}
const played = [];
function playStep() {
  if (G.phase !== 'play') return;
  const p = G.turn;
  if (p === 0) { G.msg = whyRule(G.hands[0], G.trick); render(); showHand(); return; }
  G.msg = NAMES[p] + ' joue…'; render();
  wait(800, () => playCard(p, botCard(p)));
}
function playCard(p, c) {
  const h = G.hands[p];
  h.splice(h.findIndex(x => same(x, c)), 1);
  G.trick.push({ p, c }); G.hint = null;
  // belote / rebelote
  if (p === G.belote && c.s === G.atout && (c.r === 'R' || c.r === 'D')) {
    G.beloteSaid++;
    G.say[p] = G.beloteSaid === 1 ? 'Belote !' : 'Rebelote !';
  } else delete G.say[p];
  G.turn = (p + 1) % 4;
  if (G.trick.length < 4) { render(); return playStep(); }
  const w = trickWinner(G.trick).p, wt = team(w);
  G.trick.forEach(x => { played.push(x.c); G.won[wt].push(x.c); });
  G.tricks[wt]++;
  G.last = { cards: G.trick.slice(), w };
  G.winnerSeat = w; G.phase = 'collect';
  const pts = G.trick.reduce((a, x) => a + value(x.c), 0);
  const lastT = G.hands[0].length === 0;
  if (lastT) G.lastTeam = wt;
  G.msg = (w === 0 ? 'Vous remportez le pli' : w === 2 ? 'Simone, votre partenaire, remporte le pli' : NAMES[w] + ' remporte le pli') + ` (${pts + (lastT ? 10 : 0)} points${lastT ? ', dix de der compris' : ''}).`;
  render();
  wait(1800, collect);
}
function collect() {
  clearTimeout(timer);
  if (G.phase !== 'collect') return;
  G.phase = 'collecting';
  $('trick').classList.add('gone', 'to' + G.winnerSeat);
  setTimeout(() => {
    G.trick = []; G.leader = G.winnerSeat; G.turn = G.leader; G.winnerSeat = null; G.say = {};
    if (G.hands[0].length === 0) return finish();
    G.phase = 'play'; render(); playStep();
  }, 450);
}

/* ---------- robots ---------- */
function botCard(p) {
  const h = G.hands[p], trick = G.trick, legal = legalCards(h, trick, p), A = G.atout;
  if (legal.length === 1) return legal[0];
  const low = arr => arr.slice().sort((a, b) => value(a) - value(b) || rankOf(a) - rankOf(b))[0];
  const high = arr => arr.slice().sort((a, b) => value(b) - value(a) || rankOf(b) - rankOf(a))[0];
  const seen = c => played.some(x => same(x, c));
  const master = c => {    // plus haute carte restante de sa couleur ?
    const ord = c.s === A ? T_ORDER : ORDER;
    return ord.slice(ord.indexOf(c.r) + 1).every(r => seen({ s: c.s, r }) || h.some(x => x.s === c.s && x.r === r));
  };
  const trumpsOut = 8 - played.filter(c => c.s === A).length - h.filter(c => c.s === A).length - trick.filter(x => x.c.s === A).length;
  if (!trick.length) {
    const myTeamTook = team(p) === team(G.taker);
    const tr = h.filter(c => c.s === A);
    if (myTeamTook && tr.length && trumpsOut > 0) { const m = tr.find(master); if (m) return m; if (p === G.taker && tr.length >= 3) return high(tr); }
    const aces = h.filter(c => c.s !== A && master(c) && value(c) >= 10);
    if (aces.length) return high(aces);
    const plain = h.filter(c => c.s !== A);
    if (plain.length) {
      const bySuit = SUITS.filter(s => s !== A && plain.some(c => c.s === s)).sort((a, b) => h.filter(c => c.s === b).length - h.filter(c => c.s === a).length);
      return low(plain.filter(c => c.s === bySuit[0]));
    }
    return low(h);
  }
  const cur = trickWinner(trick), left = 3 - trick.length;
  const after = [1, 2, 3].slice(0, left).map(k => (p + k) % 4);
  const oppAfter = after.some(q => team(q) !== team(p));
  const pot = trick.reduce((a, x) => a + value(x.c), 0);
  if (team(cur.p) === team(p)) {
    const safe = !oppAfter || (cur.c.s === A ? master(cur.c) || trumpsOut === 0 : master(cur.c));
    const nonT = legal.filter(c => c.s !== A);
    if (safe && nonT.length) return high(nonT);
    return low(nonT.length ? nonT : legal);
  }
  const winners = legal.filter(c => trickWinner([...trick, { p, c }]).p === p);
  if (winners.length) {
    if (!oppAfter) return low(winners);
    const sure = winners.filter(c => master(c) && (c.s === A || trumpsOut === 0 || trick[0].c.s === A));
    if (sure.length) return low(sure);
    if (pot >= 10 || winners.every(c => c.s === A)) return low(winners);
  }
  return low(legal);
}

/* =========================================================
   FIN DE DONNE ET SCORE
   ========================================================= */
function finish() {
  G.phase = 'end';
  const T = team(G.taker), D = 1 - T;
  const pts = [0, 1].map(k => G.won[k].reduce((a, c) => a + value(c), 0) + (G.lastTeam === k ? 10 : 0));
  const bel = [0, 0]; if (G.belote >= 0) bel[team(G.belote)] = 20;
  let capot = -1; if (G.tricks[0] === 8) capot = 0; if (G.tricks[1] === 8) capot = 1;
  let score = [pts[0], pts[1]], verdict;
  if (capot >= 0) { score = [0, 0]; score[capot] = 252; }
  const made = (score[T] + bel[T]) > (score[D] + bel[D]);
  const tie = (score[T] + bel[T]) === (score[D] + bel[D]);
  let mark = [0, 0];
  if (capot >= 0) { mark[capot] = 252; verdict = (capot === 0 ? 'Capot pour vous ! ' : 'Capot pour Marcel et Albert. ') + 'Tous les plis : 252 points.'; }
  else if (tie) { mark[D] = score[D]; verdict = 'Litige : égalité. La défense marque ses points, ceux du preneur iront à l’équipe qui gagnera la donne suivante.'; }
  else if (made) { mark = score.slice(); verdict = 'Contrat réussi.'; }
  else { mark[D] = 162; verdict = 'Contrat chuté : le preneur est « dedans », la défense marque les 162 points.'; }
  mark[0] += bel[0]; mark[1] += bel[1];
  if (pending && !tie) { const wTeam = mark[0] >= mark[1] ? 0 : 1; mark[wTeam] += pending; pending = 0; }
  if (tie) pending += score[T];
  totals = totals.map((t, i) => t + mark[i]);
  history.push({ taker: G.taker, atout: G.atout, pts, mark, made: made || capot === T });
  save();
  G.result = { pts, bel, mark, verdict, made, capot };
  G.msg = verdict;
  render();
  wait(900, showResult);
}
function showResult() {
  const R = G.result, T = team(G.taker);
  const who = G.taker === 0 ? 'Vous avez pris' : G.taker === 2 ? 'Simone, votre partenaire, a pris' : NAMES[G.taker] + ' a pris';
  const gameOver = totals[0] >= 1000 || totals[1] >= 1000;
  const win = totals[0] >= totals[1];
  openSheet(`<h2>Fin de la donne</h2>
    <p class="res ${R.mark[0] > R.mark[1] ? 'ok' : 'ko'}">${R.verdict}</p>
    <p>${who} à ${SUIT_NAME[G.atout]} ${suitHTML(G.atout)}.</p>
    <table><tr><th></th><th class="n">Cartes</th><th class="n">Belote</th><th class="n">Marqué</th></tr>
      <tr><td class="team0"><b>Nous</b> (vous + Simone)</td><td class="n">${R.pts[0]}</td><td class="n">${R.bel[0] || ''}</td><td class="n"><b>${R.mark[0]}</b></td></tr>
      <tr><td class="team1"><b>Eux</b> (Marcel + Albert)</td><td class="n">${R.pts[1]}</td><td class="n">${R.bel[1] || ''}</td><td class="n"><b>${R.mark[1]}</b></td></tr></table>
    <p><small>Le preneur doit faire plus de points que l’autre équipe (belote comprise). Le dernier pli rapporte 10 points de plus (« dix de der »).</small></p>
    ${totalsTable()}
    ${gameOver ? `<p class="res ${win ? 'ok' : 'ko'}">${win ? 'Bravo, vous gagnez la partie avec Simone !' : 'Marcel et Albert gagnent la partie.'}</p>` : '<p>La partie se joue en 1000 points.</p>'}
    <div class="row"><button class="act quiet" data-close>Voir le tapis</button><button class="act main" data-next>${gameOver ? 'Nouvelle partie' : 'Donne suivante'}</button></div>`);
}
function totalsTable() {
  return `<table><tr><th>Partie en 1000 points</th><th class="n">Total</th></tr>
    <tr><td class="team0"><b>Nous</b> (vous + Simone)</td><td class="n"><b>${totals[0]}</b></td></tr>
    <tr><td class="team1"><b>Eux</b> (Marcel + Albert)</td><td class="n"><b>${totals[1]}</b></td></tr></table>`;
}

/* =========================================================
   AFFICHAGE
   ========================================================= */
function seatHTML(p) {
  const el = $('seat' + p);
  const active = G.turn === p && (G.phase === 'play' || G.phase === 'bid');
  el.className = p === 0 ? 'you' + (active ? ' turn' : '') : 'seat ' + ['s', 'e', 'n', 'w'][p] + (active ? ' turn' : '');
  const role = G.taker >= 0 ? (p === G.taker ? '<span class="tag">Preneur</span>' : team(p) === 0 && p ? '<span class="tag def">Partenaire</span>' : '') : (p === 2 ? '<span class="tag def">Partenaire</span>' : '');
  const b = G.bids[p];
  let bub = '';
  if (G.phase === 'bid' || G.phase === 'allpass' || G.phase === 'take') bub = b === null ? '' : b === 'pass' ? '<span class="pass">Passe</span>' : `<span>Je prends ${SUIT_SYM[b]}</span>`;
  if (G.say[p]) bub = `<span>${G.say[p]}</span>`;
  el.innerHTML = `<div class="who"><span class="ava">${p ? NAMES[p][0] : '★'}</span><span><b>${NAMES[p]}</b>${p ? `<br><span class="cnt">${G.hands[p].length} cartes</span>` : ''}</span>${role}</div>` +
    (p || bub ? `<div class="bubble">${bub}</div>` : '');
  if (p && G.hands[p].length) {
    const bk = document.createElement('div'); bk.className = 'backs';
    for (let i = 0; i < Math.min(5, G.hands[p].length); i++) bk.append(cardEl(null));
    el.append(bk);
  }
}
function renderTrick() {
  const t = $('trick');
  t.className = 'trick'; t.replaceChildren(); t.onclick = null;
  if (['bid', 'allpass', 'take'].includes(G.phase)) {
    const d = document.createElement('div'); d.className = 'centerMsg';
    const box = document.createElement('div'); box.style.textAlign = 'center';
    const row = document.createElement('div'); row.className = 'dog'; row.style.alignItems = 'center';
    const pack = cardEl(null); pack.style.width = 'clamp(50px,9vw,80px)'; pack.style.opacity = '.9';
    const up = cardEl(G.turned); up.style.width = 'clamp(70px,13vw,112px)';
    row.append(pack, up);
    const lab = document.createElement('div'); lab.innerHTML = '<span style="margin-top:6px;display:inline-block">La carte retournée</span>';
    box.append(row, lab); d.append(box); t.append(d); return;
  }
  const lastPlayed = G.trick[G.trick.length - 1];
  for (const x of G.trick) {
    const s = document.createElement('div');
    s.className = 'slot s' + x.p + (x === lastPlayed && G.phase === 'play' ? ' in' + x.p : '') + (G.phase === 'collect' && x.p === G.winnerSeat ? ' win' : '');
    s.append(cardEl(x.c)); t.append(s);
  }
  if (G.phase === 'collect') t.onclick = collect;
}
function renderInfo() {
  const parts = [];
  if (G.atout) parts.push(`<span class="chip atoutBig">Atout ${suitHTML(G.atout)} <b>${SUIT_NAME[G.atout]}</b> · ${G.taker === 0 ? 'vous avez pris' : 'pris par ' + NAMES[G.taker]}</span>`);
  if (['play', 'collect', 'end'].includes(G.phase)) {
    const n = G.tricks[0] + G.tricks[1] + (G.phase === 'play' ? 1 : 0);
    const pts = [0, 1].map(k => G.won[k].reduce((a, c) => a + value(c), 0));
    parts.push(`<span class="chip">Pli <b>${Math.min(8, n)}</b>/8 · Nous <b>${pts[0]}</b> · Eux <b>${pts[1]}</b></span>`);
  }
  if (G.phase === 'bid') parts.push(`<span class="chip">Partie : Nous <b>${totals[0]}</b> · Eux <b>${totals[1]}</b> (en 1000)</span>`);
  $('info').innerHTML = parts.join('');
}
function btn(label, fn, cls = '') { const b = document.createElement('button'); b.className = 'act ' + cls; b.innerHTML = label; b.onclick = fn; return b; }
function renderActions() {
  const a = $('actions'); a.replaceChildren();
  if (G.phase === 'bid' && G.turn === 0) {
    if (G.round === 1) a.append(btn(`Je prends à ${SUIT_SYM[G.turned.s]} ${SUIT_NAME[G.turned.s]}`, () => doBid(0, G.turned.s), 'main'));
    else SUITS.filter(s => s !== G.turned.s).forEach(s => a.append(btn(`${SUIT_SYM[s]} ${SUIT_NAME[s]}`, () => doBid(0, s))));
    a.append(btn('Je passe', () => doBid(0, null), 'quiet'));
    a.append(btn('Un conseil ?', () => {
      let s = null;
      if (G.round === 1) s = bidScore(G.hands[0], G.turned.s, true) >= 7.5 ? G.turned.s : null;
      else { let bs = 0; for (const x of SUITS) if (x !== G.turned.s) { const v = bidScore(G.hands[0], x, false); if (v > bs) { bs = v; s = x; } } if (bs < 7.8) s = null; }
      G.msg = s ? `Avec ce jeu, je prendrais à ${SUIT_NAME[s]} ${SUIT_SYM[s]}.` : 'Votre jeu est un peu faible : je passerais.';
      render();
    }, 'quiet'));
  }
  if (G.phase === 'allpass') a.append(btn('Redistribuer', newDeal, 'main'));
  if (G.phase === 'play' && G.turn === 0) a.append(btn('Un conseil ?', () => { G.hint = botCard(0); render(); }, 'quiet'));
  if (['play', 'collect'].includes(G.phase) && G.last) a.append(btn('Dernier pli', showLast, 'quiet'));
  if (G.phase === 'collect') a.append(btn('Continuer', collect));
  if (G.phase === 'end') { a.append(btn('Voir le résultat', showResult, 'quiet')); a.append(btn('Donne suivante', newDeal, 'main')); }
}
function renderHand() {
  const box = $('hand'); box.replaceChildren();
  const h = G.hands[0], n = h.length; if (!n) return;
  const W = box.clientWidth || 360;
  // grandes cartes : jusqu'à 4 par rangée sur téléphone, toutes sur une rangée sur grand écran
  const cw = Math.round(Math.max(76, Math.min(140, W * .23)));
  box.style.setProperty('--cw', cw + 'px');
  let rows = 1;
  if (n > 1 && (W - cw) / (n - 1) < cw * .55) rows = 2;
  const perRow = Math.ceil(n / rows);
  const legal = G.phase === 'play' && G.turn === 0 ? legalCards(h, G.trick, 0) : null;
  for (let r = 0; r < rows; r++) {
    const row = document.createElement('div'); row.className = 'hrow';
    const slice = h.slice(r * perRow, (r + 1) * perRow);
    const step = slice.length > 1 ? Math.min(cw + 8, (W - cw) / (slice.length - 1)) : cw;
    slice.forEach((c, j) => {
      const b = cardEl(c, 'button');
      if (j) b.style.marginLeft = (step - cw) + 'px';
      if (G.phase === 'play') {
        const ok = legal && legal.some(x => same(x, c));
        b.classList.add(legal ? (ok ? 'ok' : 'no') : 'idle');
        b.disabled = !ok;
        if (G.hint && same(G.hint, c)) b.classList.add('hint');
        b.onclick = () => { if (ok && G.turn === 0 && G.phase === 'play') playCard(0, c); };
      } else { b.disabled = true; b.style.cursor = 'default'; }
      row.append(b);
    });
    box.append(row);
  }
}
// sur un petit écran, fait remonter la page pour que la main soit visible quand c'est à vous
function showHand() {
  const r = $('hand').getBoundingClientRect();
  if (r.bottom > innerHeight - 4) scrollBy({ top: r.bottom - innerHeight + 8, behavior: 'smooth' });
}
function render() {
  if (!G) return;
  $('status').textContent = G.msg;
  for (let p = 0; p < 4; p++) seatHTML(p);
  renderTrick(); renderInfo(); renderActions(); renderHand();
}

/* ---------- fenêtres ---------- */
function openSheet(html) { $('sheet').innerHTML = html; $('modal').hidden = false; $('sheet').querySelector('button')?.focus(); }
function closeSheet() { $('modal').hidden = true; }
$('modal').addEventListener('click', e => {
  if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeSheet();
  if (e.target.closest('[data-next]')) newDeal();
  if (e.target.closest('[data-reset]')) { totals = [0, 0]; history = []; pending = 0; save(); showScores(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
function showLast() {
  const L = G.last; if (!L) return;
  const f = L.cards.map(x => `<figure class="${x.p === L.w ? 'win' : ''}">${cardEl(x.c).outerHTML}${NAMES[x.p]}</figure>`).join('');
  openSheet(`<h2>Dernier pli</h2><div class="lastT">${f}</div><p style="text-align:center">${L.w === 0 ? 'Vous l’avez remporté.' : NAMES[L.w] + ' l’a remporté.'}</p><div class="row"><button class="act main" data-close>Fermer</button></div>`);
}
function showScores() {
  const rows = history.slice(-10).reverse().map(x => `<tr><td>${x.taker === 0 ? 'Vous' : NAMES[x.taker]} à ${suitHTML(x.atout)}</td><td>${x.made ? 'réussi' : 'chuté'}</td><td class="n">${x.mark[0]} / ${x.mark[1]}</td></tr>`).join('');
  openSheet(`<h2>Scores</h2>${totalsTable()}
    ${rows ? `<h3>Dernières donnes</h3><table><tr><th>Preneur</th><th>Contrat</th><th class="n">Nous / Eux</th></tr>${rows}</table>` : '<p>Aucune donne terminée pour l’instant.</p>'}
    <div class="row"><button class="act quiet" data-reset>Remettre à zéro</button><button class="act main" data-close>Fermer</button></div>`);
}
function showRules() {
  openSheet(`<h2>Comment jouer à la belote</h2>
  <p>Vous jouez avec <b>Simone</b>, assise en face de vous, contre Marcel (à droite) et Albert (à gauche). On joue avec 32 cartes, du 7 à l’As.</p>
  <h3>1. Choisir l’atout</h3>
  <p>Chacun reçoit 5 cartes et une carte est retournée au milieu. Au premier tour, chacun peut <b>prendre</b> dans la couleur de cette carte, ou passer. Si personne ne prend, un deuxième tour permet de choisir une autre couleur. Le preneur reçoit la carte retournée, puis tout le monde complète sa main à 8 cartes.</p>
  <h3>2. Le jeu de la carte</h3>
  <ul><li>Il faut <b>fournir</b> la couleur demandée.</li>
  <li>Si l’on n’en a pas, il faut <b>couper</b> à l’atout, sauf si votre partenaire est déjà maître du pli.</li>
  <li>À l’atout, il faut toujours <b>monter</b> plus fort si l’on peut.</li></ul>
  <p>Les cartes que vous pouvez jouer sont <b>levées et éclairées</b>, et la phrase au-dessus de votre main explique la règle à suivre.</p>
  <h3>3. L’ordre et la valeur des cartes</h3>
  <p><b>À l’atout :</b> Valet (20), 9 (14), As (11), 10 (10), Roi (4), Dame (3), 8 et 7 (0).<br>
  <b>Dans les autres couleurs :</b> As (11), 10 (10), Roi (4), Dame (3), Valet (2), 9, 8 et 7 (0).</p>
  <h3>4. Les points</h3>
  <p>Le dernier pli rapporte 10 points de plus (« dix de der »), soit 162 points en tout. Celui qui a le Roi et la Dame d’atout annonce « Belote » puis « Rebelote » : 20 points pour son équipe. L’équipe du preneur doit faire plus de points que l’autre ; sinon elle est « dedans » et l’autre équipe marque les 162 points. Faire tous les plis, c’est le <b>capot</b> : 252 points. La partie se gagne à <b>1000 points</b>.</p>
  <div class="row"><button class="act main" data-close>J’ai compris</button></div>`);
}
$('bRules').onclick = showRules;
$('bScores').onclick = showScores;
let rT; addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => G && renderHand(), 120); });
newDeal();
