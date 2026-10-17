// The laptop runs this. It holds the game, runs the clock, and talks to the TV page and every phone.
const express = require('express'), http = require('http'), os = require('os'), path = require('path');
const QR = require('qrcode'), { Server } = require('socket.io');
const { Game } = require('./game');
const { addBots, runBots } = require('./bots');

const PORT = process.env.PORT || 3000;
const app = express(), server = http.createServer(app), io = new Server(server);

// Prefer the real home Wi-Fi address over virtual adapters (WSL, VPN, VirtualBox).
const lan = () => {
  const all = [];
  for (const [n, list] of Object.entries(os.networkInterfaces())) for (const i of list)
    if (i.family === 'IPv4' && !i.internal && !/vethernet|wsl|virtual|vmware|vbox|vpn|tailscale|docker/i.test(n)) all.push(i.address);
  return all.find(a => a.startsWith('192.168.')) || all.find(a => a.startsWith('10.')) || all[0] || 'localhost';
};
const JOIN_URL = process.env.PUBLIC_URL || `http://${lan()}:${PORT}/`;
let qrSvg = '';
QR.toString(JOIN_URL, { type: 'svg', margin: 1, color: { dark: '#000000', light: '#ffffff' } }).then(s => { qrSvg = s; });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (q, r) => r.sendFile(path.join(__dirname, 'public', 'play.html')));
app.get('/api/join', (q, r) => r.json({ url: JOIN_URL, qr: qrSvg }));

const game = new Game();
const sockets = new Map(); // player id -> socket id

let sent = -1;
function broadcast(force = false) {
  if (!force && sent === game.version) return;
  sent = game.version;
  const now = Date.now();
  io.to('tv').emit('tv', game.tvView(now));
  for (const [id, sid] of sockets) io.to(sid).emit('me', game.phoneView(id, now));
}

io.on('connection', socket => {
  // ----- the TV page -----
  socket.on('tv:hello', () => {
    socket.join('tv');
    socket.emit('tv', game.tvView(Date.now()));
  });
  socket.on('tv:cmd', ({ cmd, arg } = {}) => {
    if (!socket.rooms.has('tv')) return;
    const now = Date.now();
    if (cmd === 'bots') addBots(game, 4);
    else {
      const res = game.host(cmd, now, arg);
      if (res && res.error) socket.emit('toast', res.error);
    }
    broadcast();
  });

  // ----- a phone -----
  let playerId = null;
  socket.on('p:join', ({ token, name } = {}, reply) => {
    let p = token && game.players.get(token);
    if (!p) {
      const res = game.addPlayer(name);
      if (res.error) return reply && reply({ error: res.error });
      p = res.player;
    }
    // Only one phone per seat: the newest one wins.
    const old = sockets.get(p.id);
    if (old && old !== socket.id) io.to(old).emit('kicked');
    playerId = p.id;
    p.connected = true;
    sockets.set(p.id, socket.id);
    game.touch();
    reply && reply({ token: p.id });
    broadcast(true);
  });
  socket.on('p:act', action => {
    if (!playerId) return;
    game.act(playerId, action, Date.now());
    broadcast();
  });
  socket.on('disconnect', () => {
    if (!playerId || sockets.get(playerId) !== socket.id) return;
    sockets.delete(playerId);
    const p = game.players.get(playerId);
    if (p) { p.connected = false; game.touch(); }
    broadcast();
  });
});

setInterval(() => {
  const now = Date.now();
  game.tick(now);
  runBots(game, now);
  broadcast();
}, 250);

server.listen(PORT, () => {
  console.log('\n  Village Werewolf is running.');
  console.log(`  TV screen:   http://localhost:${PORT}/tv.html`);
  console.log(`  Phones join: ${JOIN_URL}\n`);
});
