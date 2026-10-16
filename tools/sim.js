// Plays many full games with bots on a fake clock and checks nothing breaks.
// Run: npm test
const assert = require('assert');
const { Game } = require('../game');
const { addBots, runBots } = require('../bots');

const GAMES = Number(process.argv[2]) || 300;
const wins = { village: 0, wolves: 0 }, rounds = [];
let hunterShots = 0, saves = 0;

for (let g = 0; g < GAMES; g++) {
  const size = 4 + (g % 13); // every size from 4 to 16
  const game = new Game();
  addBots(game, size);
  assert.strictEqual(game.players.size, size);
  let now = 1e9;
  game.host('start', now);
  assert.strictEqual(game.phase, 'roles');
  const wolves = game.list.filter(p => p.role === 'wolf').length;
  assert(wolves >= 1 && wolves <= 3, 'wolf count');
  let steps = 0;
  while (game.phase !== 'over') {
    now += 250;
    game.tick(now);
    runBots(game, now, 1);
    // Views must always build without throwing
    game.tvView(now);
    for (const p of game.list) game.phoneView(p.id, now);
    assert(++steps < 200000, `game ${g} never ended (stuck in ${game.phase})`);
  }
  for (const l of game.lines) {
    if (/ down with them\./.test(l.text)) hunterShots++;
    if (/Healer said|patched up|Healer was busy/.test(l.text)) saves++;
  }
  const aliveWolves = game.alive.filter(p => p.role === 'wolf').length;
  if (game.winner === 'village') assert.strictEqual(aliveWolves, 0);
  else assert(aliveWolves >= game.alive.length - aliveWolves);
  assert.strictEqual(game.final.length, size);
  for (const l of game.lines) assert(!/\{\w+\}|undefined|null/.test(l.text), 'bad line: ' + l.text);
  wins[game.winner]++;
  rounds.push(game.round);
  // New game keeps the players
  game.host('newgame', now);
  assert.strictEqual(game.phase, 'lobby');
  assert.strictEqual(game.players.size, size);
}

const avg = rounds.reduce((a, b) => a + b, 0) / rounds.length;
console.log(`OK: ${GAMES} games, village ${wins.village} / wolves ${wins.wolves}, avg ${avg.toFixed(1)} rounds, ${hunterShots} hunter shots, ${saves} healer saves`);
