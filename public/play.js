// The phone page: join, peek at your secret role, and tap choices. No buzzing, no twitch controls.
const socket = io();
const app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  del: k => { try { localStorage.removeItem(k); } catch (e) {} },
};

let token = store.get('ww-token'), view = null, offset = 0, peeking = false, lastJson = '', joinError = '', kicked = false;

document.addEventListener('contextmenu', e => e.preventDefault());

socket.on('connect', () => { if (token) join(null); else if (!view) renderJoin(); });
socket.on('me', v => {
  if (!v) return;
  offset = v.now - Date.now();
  const json = JSON.stringify({ ...v, now: 0 });
  view = v;
  if (json !== lastJson) { lastJson = json; render(); }
});
socket.on('kicked', () => { kicked = true; view = null; app.innerHTML = '<h2>Seat moved</h2><p>This seat was opened on another phone.</p><button class="primary" onclick="location.reload()">Take it back</button>'; });

function join(name) {
  socket.emit('p:join', { token, name }, res => {
    if (res.error) {
      if (token) { token = null; store.del('ww-token'); }
      joinError = res.error;
      return renderJoin(name);
    }
    token = res.token; store.set('ww-token', token); joinError = '';
  });
}

function renderJoin(name = store.get('ww-name') || '') {
  app.innerHTML = `
    <h2>Join the village</h2>
    <p class="sub">Type your name as you want it on the TV.</p>
    <input id="name" maxlength="14" autocomplete="off" autocapitalize="words" placeholder="Your name" value="${esc(name)}">
    <div class="err">${esc(joinError)}</div>
    <button class="primary" id="go">Join</button>`;
  const input = document.getElementById('name');
  const go = () => { const n = input.value.trim(); if (!n) return; store.set('ww-name', n); join(n); };
  document.getElementById('go').onclick = go;
  input.onkeydown = e => { if (e.key === 'Enter') go(); };
}

const act = target => socket.emit('p:act', { type: 'pick', target });

function header() {
  const me = view.me;
  return `<div class="me"><span class="dot" style="background:${me.color}"></span>${esc(me.name)}
    <span class="tag">${me.alive ? '' : 'Ghost'}</span></div>`;
}

function roleCard() {
  const me = view.me;
  if (!me.role) return '';
  const inner = peeking ? `
      <div class="role ${me.role.key === 'wolf' ? 'wolf' : ''}">${esc(me.role.name)}</div>
      <p>${esc(me.role.blurb)}</p>
      ${view.pack ? `<p>Your pack: ${view.pack.length ? view.pack.map(w => `${esc(w.name)}${w.alive ? '' : ' (dead)'}${w.pick ? ` <span class="sub">wants ${esc(w.pick)}</span>` : ''}`).join(', ') : 'just you'}.</p>` : ''}
      ${view.seerResults && view.seerResults.length ? view.seerResults.map(r => `<div class="result">Night ${r.round}: ${esc(r.name)} is ${r.isWolf ? '<b class="yes">a Wolf!</b>' : '<b class="no">not a Wolf</b>'}</div>`).join('') : ''}
      <p class="sub">Side quest: ${esc(me.quest.text)}</p>`
    : `<div>Hold here to peek at your role</div><div class="sub">Let go to hide it again</div>`;
  return `<div class="card"><div class="peek ${peeking ? 'open' : ''}" id="peek">${inner}</div></div>`;
}

function questButton() {
  const q = view.me.quest;
  if (!q || q.auto || view.phase === 'over' || view.phase === 'lobby') return '';
  return `<div class="quest"><button id="quest" class="${q.claimed ? 'on' : ''}">${q.claimed ? 'Side quest done!' : 'I did my side quest'}</button></div>`;
}

function taskBlock() {
  const t = view.task;
  const picked = view.picked;
  // The Seer sees the answer right away
  const seerNow = t.kind === 'peek' && picked && view.seerResults ? view.seerResults.at(-1) : null;
  return `<h2>${esc(t.prompt)} <span class="timer" id="timer"></span></h2>
    ${seerNow ? `<div class="result">${esc(seerNow.name)} is ${seerNow.isWolf ? '<b class="yes">a Wolf!</b>' : '<b class="no">not a Wolf</b>'}</div>` : ''}
    <div class="opts">
      ${t.options.map(o => `<button class="opt ${picked === o.id ? 'on' : ''}" data-id="${o.id}" ${seerNow ? 'disabled' : ''}><span class="dot" style="background:${o.color}"></span><span>${esc(o.name)}</span></button>`).join('')}
      ${t.canSkip ? `<button class="opt skip ${picked === 'skip' ? 'on' : ''}" data-id="skip">Skip, nobody</button>` : ''}
    </div>
    <p class="sub">${picked ? 'Got it. You can change your mind until time runs out.' : 'Tap one.'}</p>`;
}

const LOOK_UP = {
  lobby: ['You\'re in!', 'Waiting for the host to start the game. Look at the TV.'],
  roles: ['Your secret role', 'Hold the card below to peek. Don\'t let anyone see!'],
  morning: ['Look up!', 'The narrator has news.'],
  day: ['Discuss!', 'Look up and argue it out. You will vote on your phone when the timer ends.'],
  hunter: ['Look up!', 'The Hunter is choosing a target.'],
  voteReveal: ['Look up!', 'The votes are being revealed.'],
  voteResult: ['Look up!', 'The village has spoken.'],
  night: ['Night', 'Keep your phone hidden.'],
  vote: ['Vote', ''],
};

function render() {
  if (!view) return;
  let body = header();
  if (!view.me.alive && view.phase !== 'over') body += `<div class="ghost">You are a Ghost. No talking! Moaning and dramatic pointing are allowed.</div>`;
  if (view.phase === 'over') {
    const f = view.final;
    body += `<h2>${view.winner === 'wolves' ? 'The Wolves win!' : 'The Village wins!'}</h2>
      <p>You were the <b>${esc(view.me.role.name)}</b>. ${f.won ? '<span class="done">Your team won.</span>' : 'Your team lost.'}</p>
      <p>Side quest: ${esc(view.me.quest.text)} ${f.questDone ? '<span class="done">Done!</span>' : '<span class="sub">Not done.</span>'}</p>
      <p>Your score: <b>${f.score}</b></p><p class="sub">The full scoreboard is on the TV.</p>`;
  } else if (view.task) {
    body += taskBlock() + roleCard();
  } else {
    const [h, s] = LOOK_UP[view.phase] || ['', ''];
    body += `<h2>${esc(h)} <span class="timer" id="timer"></span></h2><p class="sub">${esc(s)}</p>${roleCard()}${view.phase === 'day' ? questButton() : ''}`;
  }
  if (view.task && view.phase === 'vote') body += questButton();
  app.innerHTML = body;

  app.querySelectorAll('.opt').forEach(b => b.onclick = () => act(b.dataset.id));
  const q = document.getElementById('quest');
  if (q) q.onclick = () => socket.emit('p:act', { type: 'quest' });
  const peek = document.getElementById('peek');
  if (peek) peek.onpointerdown = e => { e.preventDefault(); peeking = true; render(); };
  tickTimer();
}
const stopPeek = () => { if (peeking) { peeking = false; render(); } };
window.addEventListener('pointerup', stopPeek);
window.addEventListener('pointercancel', stopPeek);
document.addEventListener('visibilitychange', stopPeek);

function tickTimer() {
  const el = document.getElementById('timer');
  if (!el || !view) return;
  const left = view.endsAt ? Math.max(0, Math.ceil((view.endsAt - (Date.now() + offset)) / 1000)) : null;
  el.textContent = left === null ? '' : left >= 60 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : `${left}s`;
}
setInterval(tickTimer, 500);
