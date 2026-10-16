// Bot villagers for testing with fewer real people. They tap random choices after a short pause.
const BOT_NAMES = ['Barnaby', 'Mildred', 'Ezekiel', 'Agatha', 'Thaddeus', 'Prudence', 'Cornelius', 'Hester',
  'Bartholomew', 'Winifred', 'Ignatius', 'Ophelia', 'Mortimer', 'Gertrude', 'Silas', 'Edna'];

function addBots(game, count) {
  let added = 0;
  for (const base of BOT_NAMES) {
    if (added >= count) break;
    if ([...game.players.values()].some(p => p.name === base)) continue;
    if (game.addPlayer(base, true).player) added++;
  }
  return added;
}

// Call every tick. `speed` lets the simulator run bots instantly.
function runBots(game, now, speed = 1) {
  for (const p of game.players.values()) {
    if (!p.isBot) continue;
    const t = game.task(p);
    const key = `${game.phase}:${game.round}`;
    if (!t || game.picked(p) || p.botDoneKey === key) { if (!t) p.botAt = 0; continue; }
    if (!p.botAt) { p.botAt = now + (1500 + Math.random() * 6000) / speed; continue; }
    if (now < p.botAt) continue;
    p.botAt = 0;
    if (t.kind === 'shoot' || t.kind === 'peek') p.botDoneKey = key;
    const skip = t.canSkip && Math.random() < 0.1;
    const o = t.options[Math.floor(Math.random() * t.options.length)];
    game.act(p.id, { type: t.kind === 'shoot' ? 'shoot' : 'pick', target: skip || !o ? 'skip' : o.id }, now);
  }
}

module.exports = { addBots, runBots };
