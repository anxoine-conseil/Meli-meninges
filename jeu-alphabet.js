{
// Une ou plusieurs images par lettre selon le thème.
// L'aperçu hors ligne intègre les mêmes portraits directement dans le fichier.
const config = window.meliAlphabet;
const photoFor = (id, format = 'vignettes') => window.alphabetPortraits?.[id]?.[format]
  ?? `${config.assets}/${format}/${id}.webp`;
const ALL = config.rows.map(([l, n, c, s]) => ({ l, n, c, id: s, photo: photoFor(s), buttonPhoto: photoFor(s, 'boutons'), ok: false }));
const LETTERS = [...new Set(ALL.map(f => f.l))];
let byL = {};
const LETTRE_SEULE = new Set([]); // toutes les lettres ont maintenant leur fleur
const LT = Object.fromEntries([...LETTRE_SEULE].map(l => [l, { l, n: 'La lettre ' + l, c: '#f2c230', letter: true, ok: false }]));
function drawSet() { byL = Object.fromEntries(LETTERS.map(l => { if (LT[l]) return [l, LT[l]]; const c = ALL.filter(f => f.l === l), p = c.filter(f => f.ok); const pool = p.length ? p : c; return [l, pool[Math.floor(Math.random() * pool.length)]]; })); }
drawSet();
const WORDS = config.words;
const LEVELS = { 1: 'Mots courts, avec aide', 2: 'Mots de 5 lettres', 3: `Mots longs, ${config.withItems} bougent`, 4: `Deux mots, ${config.withItems} bougent`, 5: `Une phrase, ${config.withItems} bougent vite`, 6: `Phrases longues, ${config.withItems} bougent très vite` };
const $ = id => document.getElementById(id);
const P = window.parent !== window ? window.parent : null;
const api = () => { try { return P && P.mmApi; } catch (e) { return null; } };
const mm = (pose, t, ms) => { try { api()?.mm(pose, t, ms); } catch (e) {} };
const snd = k => { try { api()?.[k]?.(); } catch (e) {} };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const MOVE = { 3: 30, 4: 25, 5: 20, 6: 15 };
let lastMove = Date.now(), warned = false;
let mode = 'abc', lv = 1, seen = {}, round = 0, pts = 0, target = '', letters = [], filled = [], errors = 0, done = false, words = [];
try { lv = +localStorage.getItem(config.levelKey) || 1; } catch (e) {}

function flHTML(f, extra = '') {
  if (f.letter) return `<div class="fl lettre ${extra}" aria-label="${f.n}"><b>${f.l}</b></div>`;
  return `<div class="fl${f.ok ? ' photo' : ''} ${extra}"${f.ok ? ` data-alphabet-photo="${f.id}"` : ''} style="background:radial-gradient(circle at 35% 30%, ${f.c}cc, ${f.c})">${f.ok ? `<img src="${f.buttonPhoto}" alt="" draggable="false">` : ''}<span class="nm">${f.n}</span>${f.ok ? `<span class="lt">${f.l}</span>` : ''}</div>`;
}
function pickWords() {
  const pool = WORDS[lv].slice(); seen[lv] = seen[lv] || new Set();
  let fresh = pool.filter(w => !seen[lv].has(w)); if (fresh.length < 5) { seen[lv].clear(); fresh = pool; }
  words = shuffle(fresh.slice()).slice(0, 5); words.forEach(w => seen[lv].add(w));
}
function start() { pickWords(); round = 0; pts = 0; newWord(); }
function newWord() {
  target = words[round]; letters = []; target.split('').forEach((ch, i) => { if (ch !== ' ') letters.push({ ch, i }); });
  drawSet(); lastMove = Date.now();
  filled = []; errors = 0; done = false; $('nW').textContent = round + 1; $('pts').textContent = pts;
  $('nextBtn').textContent = round < 4 ? 'Mot suivant' : 'Nouvelle partie';
  if (mode === 'ecrire') {
    $('ask').textContent = lv === 1 ? `Écrivez ce mot avec ${config.withItems} (restez appuyé sur ${config.one} pour voir sa lettre) :` : (target.includes(' ') ? `Écrivez ce message avec ${config.withItems} :` : `Écrivez ce mot avec ${config.withItems} :`);
    $('guessBox').classList.add('hidden'); $('tray').parentElement && $('tray').classList.remove('hidden');
    $('clearBtn').classList.remove('hidden');
    say(`Touchez ${config.withItems} dans l’ordre, ou faites-les glisser dans les ronds.`);
  } else {
    $('ask').textContent = `Quel est le message de ${config.theseItems} ? Pensez au nom de ${config.eachItem}…`;
    $('guessBox').classList.remove('hidden'); $('tray').classList.add('hidden'); $('clearBtn').classList.add('hidden');
    $('guess').value = ''; say('Tapez votre réponse puis « Valider ».');
  }
  render(); renderTray();
}
function slotSize() { const n = Math.max(...target.split(' ').map(w => w.length)); const w = Math.min(window.innerWidth, 1100); return Math.max(40, Math.min(78, Math.floor((w - 60) / n) - 10)); }
function render() {
  if (zoomAnchor && $('word').contains(zoomAnchor)) closePhotoZoom();
  const s = slotSize(); let k = 0;
  $('word').style.setProperty('--s', s + 'px');
  $('word').innerHTML = target.split(' ').map(w => `<div class="wgroup">${w.split('').map(ch => {
    const idx = k++, f = mode === 'secret' ? byL[ch] : filled[idx];
    const cls = ['slot', f ? 'full' : '', mode === 'ecrire' && idx === filled.length && !done ? 'next' : '', mode === 'secret' && !done ? 'hideLet' : ''].join(' ');
    return `<div class="${cls}" data-i="${idx}"><div class="let">${ch}</div><div class="hole">${f ? flHTML(f, mode === 'ecrire' && idx === filled.length - 1 ? 'pop' : '') : ''}</div></div>`;
  }).join('')}</div>`).join('');
}
function renderTray() {
  if (zoomAnchor && $('tray').contains(zoomAnchor)) closePhotoZoom();
  const t = Math.min(78, Math.max(58, Math.floor((Math.min(window.innerWidth, 1100) - 60) / 9)));
  $('tray').style.setProperty('--t', t + 'px');
  const order = shuffle(Object.values(byL));
  $('tray').innerHTML = order.map(f => `<button data-l="${f.l}" aria-label="${f.ok ? config.one : config.missingLabel + f.n}">${flHTML(f)}</button>`).join('');
  const missing = Object.values(byL).filter(f => !f.ok).length;
  $('note').textContent = (missing ? config.fallback : '') + (MOVE[lv] ? `Attention : à ce niveau, ${config.withItems} changent de place toutes les ${MOVE[lv]} secondes.` : '');
}
const pickOk = () => ['Oui !', 'Bien vu !', 'Exact !', 'Bravo !'][Math.floor(Math.random() * 4)];
function say(t, c = '') { const m = $('msg'); m.textContent = t; m.className = 'msg ' + c; }
function place(l) {
  if (done || mode !== 'ecrire') return;
  const need = letters[filled.length].ch, f = byL[l];
  if (l === need) {
    filled.push(f); snd('place'); render();
    if (filled.length === letters.length) win(); else say(f.letter ? `Oui, la lettre ${l} !` : f.ok ? pickOk() : `Oui : ${f.n} commence par ${l}.`, 'ok');
  } else {
    errors++; snd('no');
    say(f.letter ? `C’est la lettre ${l}, pas ${need}.` : f.ok ? `Non, ${config.thisItem} ne commence pas par ${need}. Repensez à son nom…` : `${f.n} commence par ${l}, pas par ${need}. Essayez une autre image.`, 'no');
    const b = $('tray').querySelector(`[data-l="${l}"]`); b?.classList.remove('shake'); void b?.offsetWidth; b?.classList.add('shake');
  }
}
function win() {
  done = true; const g = errors === 0 ? 3 : errors < 3 ? 2 : 1; pts += g; $('pts').textContent = pts; render();
  say(errors === 0 ? `Bravo, sans faute ! +${g} points` : `Bravo, c’est écrit ! +${g} point${g > 1 ? 's' : ''}`, 'win');
  snd('win');
  if (round === 4) setTimeout(() => say(`Partie terminée : ${pts} points sur 15. Touchez « Nouvelle partie » pour rejouer.`, 'win'), 1800);
}
function hint() {
  if (done) return;
  if (mode === 'secret') { const k = Math.min(letters.length - 1, (hint.n = (hint.n || 0) + 1) - 1); const f = byL[letters[k].ch]; errors++; say(`L’image n°${k + 1} donne la lettre ${f.l}.`); return; }
  const f = byL[letters[filled.length].ch]; errors++;
  $('tray').querySelectorAll('button').forEach(b => b.classList.toggle('hint', b.dataset.l === f.l));
  say(f.letter ? `Ici, cherchez simplement la lettre ${f.l}.` : f.ok ? `Cherchez ${config.theItem} qui brille : son nom commence par ${f.l}.` : `Il faut ${config.theItem} qui commence par ${f.l} : ${f.n}.`);
  setTimeout(() => $('tray').querySelectorAll('.hint').forEach(b => b.classList.remove('hint')), 2500);
}
const norm = s => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
function guess() {
  if (done) return; const v = norm($('guess').value); if (!v) return;
  if (v.replace(/ /g, '') === target.replace(/ /g, '')) { win(); }
  else { errors++; snd('no'); say(`Pas tout à fait… Repensez au nom de ${config.eachItem}, dans l’ordre.`, 'no'); }
}
// ---- glisser-déposer + toucher ----
let drag = null;
$('tray').addEventListener('pointerdown', e => {
  const b = e.target.closest('button[data-l]'); if (!b || mode !== 'ecrire') return;
  drag = { l: b.dataset.l, x: e.clientX, y: e.clientY, moved: false, el: null, b, t: setTimeout(() => { if (lv === 1 && drag && !drag.moved) b.querySelector('.fl').classList.add('showName'); }, 450) };
  b.setPointerCapture(e.pointerId);
});
$('tray').addEventListener('pointermove', e => {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 10) {
    drag.moved = true; clearTimeout(drag.t);
    drag.el = document.createElement('div'); drag.el.className = 'drag'; drag.el.style.setProperty('--s', getComputedStyle($('tray')).getPropertyValue('--t'));
    drag.el.innerHTML = flHTML(byL[drag.l]); document.body.appendChild(drag.el);
  }
  if (drag.el) { drag.el.style.left = e.clientX + 'px'; drag.el.style.top = e.clientY + 'px'; }
});
function endDrag(e) {
  if (!drag) return; clearTimeout(drag.t); drag.b.querySelector('.fl')?.classList.remove('showName');
  const d = drag; drag = null;
  if (d.el) { d.el.remove(); const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('.slot'); if (over && +over.dataset.i === filled.length) place(d.l); else if (over) say(`Posez ${config.withItems} dans l’ordre, de gauche à droite.`, 'no'); }
  else place(d.l);
}
$('tray').addEventListener('pointerup', endDrag);
$('tray').addEventListener('pointercancel', () => { if (drag) { clearTimeout(drag.t); drag.el?.remove(); drag = null; } });
$('tray').addEventListener('click', e => { if (e.detail === 0) { const b = e.target.closest('button[data-l]'); if (b) place(b.dataset.l); } });
$('clearBtn').addEventListener('click', () => { if (!done && filled.length) { filled.pop(); render(); say(config.removed); } });
$('hintBtn').addEventListener('click', hint);
$('guessBtn').addEventListener('click', guess);
$('guess').addEventListener('keydown', e => { if (e.key === 'Enter') guess(); });
$('nextBtn').addEventListener('click', () => { hint.n = 0; if (round < 4) { round++; newWord(); } else start(); });
$('lv').innerHTML = Object.entries(LEVELS).map(([k, t]) => `<button data-v="${k}" aria-pressed="${+k === lv}" title="${t}">${k}</button>`).join('') + `<span class="note" id="lvTxt" style="margin:0 0 0 6px">${LEVELS[lv]}</span>`;
$('lv').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; lv = +b.dataset.v; try { localStorage.setItem(config.levelKey, lv); } catch (e) {} $('lv').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); $('lvTxt').textContent = LEVELS[lv]; hint.n = 0; start(); });
document.querySelectorAll('.mode button').forEach(b => b.addEventListener('click', () => {
  closePhotoZoom();
  mode = b.dataset.mode; document.querySelectorAll('.mode button').forEach(x => x.setAttribute('aria-pressed', x === b));
  $('play').classList.toggle('hidden', mode === 'abc'); $('abcView').classList.toggle('hidden', mode !== 'abc');
  if (mode === 'abc') renderAbc(); else { hint.n = 0; start(); }
  if (mode === 'secret') mm('question', config.introSecret, 5000);
  if (mode === 'abc') mm('jouer', config.introAlphabet, 5000);
}));
function renderAbc() {
  $('abc').innerHTML = ALL.map(f => `
    <button type="button" class="abc-card" data-alphabet-photo="${f.id}" data-caption="${f.n}">
      <span class="abc-letter">${f.l}</span>
      <img src="${f.photo}" alt="" loading="lazy" draggable="false">
      <span class="abc-name">${f.n}</span>
    </button>`).join('');
}

let zoomAnchor = null;
let zoomPinned = false;

function closePhotoZoom() {
  $('photoZoom').classList.add('hidden');
  zoomAnchor = null;
  zoomPinned = false;
}

function positionPhotoZoom() {
  if (!zoomAnchor) return;
  if (!zoomAnchor.isConnected) { closePhotoZoom(); return; }
  const area = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  try {
    const frame = window.frameElement?.getBoundingClientRect();
    if (frame) {
      area.left = Math.max(0, -frame.left);
      area.top = Math.max(0, -frame.top);
      area.right = Math.min(area.right, window.parent.innerWidth - frame.left);
      area.bottom = Math.min(area.bottom, window.parent.innerHeight - frame.top);
    }
  } catch {}
  const rect = zoomAnchor.getBoundingClientRect();
  if (rect.bottom < area.top || rect.top > area.bottom) { closePhotoZoom(); return; }
  const panel = $('photoZoom');
  const width = Math.min(350, area.right - area.left - 24);
  const height = Math.min(390, area.bottom - area.top - 24);
  if (width < 80 || height < 80) { closePhotoZoom(); return; }
  let left = rect.right + 12;
  if (left + width > area.right - 12) left = rect.left - width - 12;
  if (left < area.left + 12) left = area.left + (area.right - area.left - width) / 2;
  const top = Math.max(area.top + 12, Math.min(rect.top + (rect.height - height) / 2, area.bottom - height - 12));
  Object.assign(panel.style, { width: width + 'px', height: height + 'px', left: left + 'px', top: top + 'px' });
}

function openPhotoZoom(anchor, pinned = false) {
  if (zoomAnchor !== anchor) {
    zoomAnchor = anchor;
    $('photoZoomImage').src = photoFor(anchor.dataset.alphabetPhoto, 'grands');
    $('photoZoomName').textContent = anchor.dataset.caption || '';
  }
  zoomPinned = pinned;
  $('photoZoom').classList.remove('hidden');
  positionPhotoZoom();
}

document.addEventListener('pointerover', e => {
  const photo = e.target.closest('[data-alphabet-photo]');
  if (e.pointerType === 'mouse' && photo && !zoomPinned && !photo.contains(e.relatedTarget)) openPhotoZoom(photo);
});
document.addEventListener('pointerout', e => {
  if (zoomAnchor && !zoomPinned && zoomAnchor.contains(e.target) && !zoomAnchor.contains(e.relatedTarget)) closePhotoZoom();
});
$('abc').addEventListener('focusin', e => {
  if (e.target.matches('.abc-card:focus-visible')) openPhotoZoom(e.target);
});
$('abc').addEventListener('focusout', e => { if (e.target === zoomAnchor) closePhotoZoom(); });
document.addEventListener('click', e => {
  const photo = e.target.closest('.abc-card');
  if (photo && !(photo === zoomAnchor && zoomPinned)) openPhotoZoom(photo, true);
  else closePhotoZoom();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePhotoZoom(); });
window.addEventListener('scroll', positionPhotoZoom, { passive: true });
window.addEventListener('resize', positionPhotoZoom);
try { if (window.frameElement) window.parent.addEventListener('scroll', positionPhotoZoom, { passive: true }); } catch {}
function moveTray() {
  const btns = [...$('tray').children], first = new Map(btns.map(b => [b, b.getBoundingClientRect()]));
  shuffle(btns).forEach(b => $('tray').appendChild(b));
  btns.forEach(b => { const a = first.get(b), z = b.getBoundingClientRect(); b.animate([{ transform: `translate(${a.left - z.left}px, ${a.top - z.top}px)` }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.3,.9,.3,1)' }); });
  if (!warned) { warned = true; mm('noeud', `Oh ! ${config.withItems} ont changé de place… Ouvrez l’œil !`, 4500); }
}
setInterval(() => {
  if (mode !== 'ecrire' || done || drag || !MOVE[lv] || document.hidden) return;
  if (Date.now() - lastMove > MOVE[lv] * 1000) { lastMove = Date.now(); moveTray(); }
}, 1000);
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (mode !== 'abc') { render(); } }, 150); });
// photos : chacune remplace son rond dès qu'elle existe
let left = ALL.length;
ALL.forEach(f => { const im = new Image(); im.onload = () => { f.ok = true; if (!--left) refresh(); }; im.onerror = () => { if (!--left) refresh(); }; im.src = f.buttonPhoto; });
function refresh() { if (mode !== 'abc') { if (!filled.length) drawSet(); render(); renderTray(); } }
renderAbc();
}
