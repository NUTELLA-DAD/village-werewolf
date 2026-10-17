// The TV page: shows public information only, and speaks the narrator's lines.
const socket = io();
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let view = null, offset = 0, join = { url: '', qr: '' };
let voiceOn = true, unlocked = false, lastSpoken = null, speaking = null;
const queue = [];

fetch('/api/join').then(r => r.json()).then(j => { join = j; render(); });

socket.on('connect', () => socket.emit('tv:hello'));
socket.on('tv', v => {
  offset = v.now - Date.now();
  view = v;
  // Don't replay old lines when the page first loads or reconnects
  if (lastSpoken === null) lastSpoken = Math.max(0, ...v.lines.map(l => l.id));
  for (const l of v.lines) if (l.id > lastSpoken) { queue.push(l); lastSpoken = l.id; }
  pump();
  render();
});
socket.on('toast', msg => {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
});

const cmd = (c, arg) => socket.emit('tv:cmd', { cmd: c, arg });
$('skip').onclick = () => cmd('skip');
$('newgame').onclick = () => { if (confirm('Start a new game? Everyone stays joined.')) cmd('newgame'); };
$('voice').onclick = () => {
  voiceOn = !voiceOn;
  $('voice').textContent = 'Voice: ' + (voiceOn ? 'on' : 'off');
  if (!voiceOn) { speechSynthesis.cancel(); queue.length = 0; speaking = null; render(); }
};
$('overlay').onclick = () => {
  unlocked = true;
  $('overlay').remove();
  // Browsers only allow speech after a click; a silent line unlocks it.
  try { speechSynthesis.speak(new SpeechSynthesisUtterance(' ')); } catch (e) {}
  pump();
};

// ---------- narrator voice ----------

function pickVoice() {
  const vs = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
  return vs.find(v => /daniel|george|arthur|male|david|fred/i.test(v.name)) || vs.find(v => /en-GB/i.test(v.lang)) || vs[0] || null;
}

function pump() {
  if (speaking || !queue.length) return;
  const line = queue.shift();
  speaking = line;
  render();
  if (!voiceOn || !unlocked || !('speechSynthesis' in window)) {
    // No voice: hold each caption long enough to read.
    setTimeout(done, Math.min(7000, 1500 + line.text.length * 45));
    return;
  }
  const u = new SpeechSynthesisUtterance(line.text);
  const v = pickVoice(); if (v) u.voice = v;
  u.rate = 0.92; u.pitch = 0.75;
  u.onend = u.onerror = done;
  speechSynthesis.speak(u);
  // Safety net in case the browser never fires onend
  setTimeout(() => { if (speaking === line) done(); }, 2000 + line.text.length * 110);
  function done() { if (speaking === line) { speaking = null; render(); setTimeout(pump, 350); } }
}

// ---------- screens ----------

const TITLES = {
  lobby: ['Village Werewolf', 'Scan to join the village'],
  roles: ['Check your phone', 'Keep your role secret'],
  night: ['Night falls', 'Everyone, tap your phone'],
  morning: ['Morning', 'Look who survived'],
  hunter: ['The Hunter strikes', 'One last shot'],
  day: ['Day in the village', 'Argue, accuse, persuade'],
  vote: ['Vote!', 'Tap a name on your phone'],
  voteReveal: ['The votes are in', 'One by one'],
  voteResult: ['The village has spoken', ''],
  over: ['Game over', 'The secrets come out'],
};

function caption() {
  const line = speaking || (view.lines.length ? view.lines.at(-1) : null);
  return `<div class="caption">${line ? esc(line.text) : '&nbsp;'}</div>`;
}

function tiles(clickable) {
  return `<div class="grid">${view.players.map(p => `
    <div class="tile ${p.alive ? '' : 'dead'} ${p.connected ? '' : 'off'} ${clickable ? 'click' : ''}" data-id="${p.id}" title="${clickable ? 'Click to remove' : ''}">
      <span class="dot" style="background:${p.color}"></span><span class="nm">${esc(p.name)}</span>
      ${p.role ? `<span class="rl">${esc(p.role)}</span>` : p.isBot ? '<span class="rl">bot</span>' : ''}
    </div>`).join('')}</div>`;
}

function lobby() {
  const n = view.players.length;
  return `<div class="lobby">
    <div><div class="qr">${join.qr}</div><div class="url">${esc(join.url)}</div></div>
    <div>
      <p class="big">${n} of ${view.maxPlayers} villagers have joined. ${n < view.minPlayers ? `Need at least ${view.minPlayers}.` : n < 6 ? 'Six or more plays best.' : 'Ready when you are!'}</p>
      ${tiles(true)}
      <p class="sub">Phones must be on the same Wi-Fi as this laptop. Click a name to remove it.</p>
      <div class="row">
        <button class="primary" id="start" ${n < view.minPlayers ? 'disabled' : ''}>Start game</button>
        <button id="bots" ${n >= view.maxPlayers ? 'disabled' : ''}>Add 4 bots</button>
        <button id="vamps" title="Vampires join at ${view.vampiresAt} or more players">Vampires: ${view.vampiresOn ? (n >= view.vampiresAt ? 'on' : `on at ${view.vampiresAt}+ players`) : 'off'}</button>
      </div>
    </div>
  </div>`;
}

function progress() {
  if (!view.toAct) return '';
  const pct = Math.round(100 * view.acted / view.toAct);
  return `<div><div class="sub">${view.acted} of ${view.toAct} have chosen</div><div class="meter"><i style="width:${pct}%"></i></div></div>`;
}

function votes() {
  const now = Date.now() + offset;
  const shown = view.phase === 'voteResult' ? view.reveal.length
    : Math.max(0, Math.min(view.reveal.length, Math.floor((now - view.revealStart) / (view.revealPer * 1000)) + 1));
  const list = view.reveal.slice(0, shown);
  const tally = {};
  for (const r of list) if (r.target) tally[r.target] = (tally[r.target] || 0) + 1;
  const max = Math.max(1, ...Object.values(tally));
  const bars = Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([n, c]) =>
    `<div class="bar"><span>${esc(n)}</span><b style="width:${100 * c / max}%"></b><span>${c}</span></div>`).join('');
  return `<div class="votes">
    <div class="feed">${list.map(r => `<div>${esc(r.voter)} &rarr; ${r.target ? esc(r.target) : '<span class="sub">skipped</span>'}</div>`).join('')}</div>
    <div class="tally">${bars}</div>
  </div>`;
}

function final() {
  const w = { wolves: 'The Wolves win!', vampires: 'The Vampires win!', village: 'The Village wins!' }[view.winner];
  return `<div class="banner">${w}</div>
  <table><thead><tr><th>Player</th><th>Role</th><th>Side quest</th><th>Done?</th><th class="num">Ghost bets</th><th class="num">Score</th></tr></thead><tbody>
  ${view.final.map(f => `<tr>
    <td><span style="color:${f.color}">&#9679;</span> ${esc(f.name)}${f.alive ? '' : ' <span class="sub">(ghost)</span>'}</td>
    <td class="${f.won ? 'won' : 'lost'}">${esc(f.role)}</td>
    <td>${esc(f.quest)}</td>
    <td>${f.questDone ? '<span class="won">Yes</span>' : '<span class="lost">No</span>'}</td>
    <td class="num">${f.bets}</td>
    <td class="num"><b>${f.score}</b></td></tr>`).join('')}
  </tbody></table>`;
}

function render() {
  if (!view) return;
  const [t, k] = TITLES[view.phase] || ['', ''];
  $('title').innerHTML = `${esc(view.phase === 'night' || view.phase === 'day' ? `${t}, round ${view.round}` : t)}<small>${esc(k)}</small>`;
  document.body.className = view.phase === 'night' ? 'dark' : (view.phase === 'day' || view.phase === 'vote') ? 'day' : '';
  let html;
  if (view.phase === 'lobby') html = lobby();
  else if (view.phase === 'over') html = caption() + final();
  else if (view.phase === 'voteReveal' || view.phase === 'voteResult') html = caption() + votes();
  else html = caption() + progress() + tiles(false);
  $('main').innerHTML = html;
  const alive = view.players.filter(p => p.alive).length;
  $('status').textContent = view.phase === 'lobby' ? '' : `${alive} alive, ${view.players.length - alive} ghosts`;
  $('skip').disabled = !view.endsAt;
  if ($('start')) $('start').onclick = () => cmd('start');
  if ($('bots')) $('bots').onclick = () => cmd('bots');
  if ($('vamps')) $('vamps').onclick = () => cmd('vampires');
  if (view.phase === 'lobby') document.querySelectorAll('.tile.click').forEach(el => el.onclick = () => cmd('remove', el.dataset.id));
  tickTimer();
}

let lastShown = -1;
function tickTimer() {
  if (!view) return;
  const left = view.endsAt ? Math.max(0, Math.ceil((view.endsAt - (Date.now() + offset)) / 1000)) : null;
  const el = $('timer');
  el.textContent = left === null ? '' : left >= 60 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : String(left);
  el.className = 'timer' + (left !== null && left <= 10 ? ' low' : '');
  // Vote reveal is animated locally, so redraw it as each vote lands
  if (view.phase === 'voteReveal') {
    const shown = Math.floor((Date.now() + offset - view.revealStart) / (view.revealPer * 1000));
    if (shown !== lastShown) { lastShown = shown; $('main').innerHTML = caption() + votes(); }
  }
}
setInterval(tickTimer, 200);
