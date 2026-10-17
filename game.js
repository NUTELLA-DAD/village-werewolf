// The whole game as a state machine. No timers or sockets in here: the server (or the
// simulator) passes in the current time, so a full game can be tested in milliseconds.
const crypto = require('crypto');
const C = require('./config');
const T = require('./content');

const COLORS = ['#e63946', '#f4a261', '#f1c40f', '#2a9d8f', '#3a86ff', '#8338ec', '#ff5da2', '#06d6a0',
  '#ff7b00', '#00b4d8', '#9ef01a', '#b5179e', '#e9ecef', '#a47148', '#4cc9f0', '#ff4d6d'];

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Most-picked value in a list; a tie is broken at random (or returns null when tieIsNull).
function topPick(values, tieIsNull = false) {
  const n = {}; for (const v of values) if (v) n[v] = (n[v] || 0) + 1;
  const best = Math.max(0, ...Object.values(n));
  if (!best) return null;
  const top = Object.keys(n).filter(k => n[k] === best);
  if (top.length > 1 && tieIsNull) return null;
  return T.pick(top);
}

class Game {
  constructor() {
    this.players = new Map(); // id -> player, in join order
    this.vampiresOn = true;   // host can switch the Vampires off in the lobby
    this.lines = [];          // narrator lines, newest last
    this.lineId = 0;
    this.version = 0;         // bumps on every change, so the server knows when to resend
    this.reset();
  }

  reset() {
    this.phase = 'lobby';
    this.endsAt = 0;
    this.round = 0;
    this.night = null;        // { picks: {id: target}, decoys: {id: prompt} }
    this.vote = null;         // { votes: {id: target|'skip'}, bets: {id: target} }
    this.reveal = [];         // ordered votes for the TV to show one at a time
    this.dayVotes = [];       // history for side quest checks
    this.lastProtected = null;
    this.hunter = null;       // { id, after: 'day'|'night', picked }
    this.stallAt = 0;
    this.winner = null;
    this.final = null;
    for (const p of this.players.values()) Object.assign(p, {
      alive: true, role: null, quest: null, questClaimed: false, betPoints: 0, seerResults: [], notes: [], score: 0,
    });
    this.touch();
  }

  touch() { this.version++; }

  say(text) {
    this.lines.push({ id: ++this.lineId, text });
    if (this.lines.length > 30) this.lines.shift();
    this.touch();
  }

  // ---------- players ----------

  addPlayer(name, isBot = false) {
    name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 14);
    if (!name) return { error: 'Type a name first.' };
    const same = [...this.players.values()].find(p => p.name.toLowerCase() === name.toLowerCase());
    if (same) {
      // A phone that lost its saved seat can take it back by typing the same name.
      if (!same.connected && !same.isBot) return { player: same };
      return { error: 'Someone already has that name.' };
    }
    if (this.phase !== 'lobby') return { error: 'A game is running. You can join the next one.' };
    if (this.players.size >= C.MAX_PLAYERS) return { error: `The village is full (${C.MAX_PLAYERS} players).` };
    const used = new Set([...this.players.values()].map(p => p.color));
    const p = {
      id: crypto.randomBytes(8).toString('hex'), name, isBot, connected: isBot,
      color: COLORS.find(c => !used.has(c)) || COLORS[this.players.size % COLORS.length],
      alive: true, role: null, quest: null, questClaimed: false, betPoints: 0, seerResults: [], notes: [], score: 0,
    };
    this.players.set(p.id, p);
    this.touch();
    return { player: p };
  }

  removePlayer(id) {
    if (this.phase !== 'lobby') return;
    this.players.delete(id);
    this.touch();
  }

  get list() { return [...this.players.values()]; }
  get alive() { return this.list.filter(p => p.alive); }
  get ghosts() { return this.list.filter(p => !p.alive); }
  name(id) { return this.players.get(id)?.name ?? 'Someone'; }

  // ---------- host buttons ----------

  host(cmd, now, arg) {
    if (cmd === 'start' && this.phase === 'lobby') return this.start(now);
    if (cmd === 'skip' && this.endsAt) { this.endsAt = now; return this.tick(now); }
    if (cmd === 'newgame') { this.reset(); return; }
    if (cmd === 'remove') return this.removePlayer(arg);
    if (cmd === 'vampires' && this.phase === 'lobby') { this.vampiresOn = !this.vampiresOn; this.touch(); }
  }

  start(now) {
    const n = this.players.size;
    if (n < C.MIN_PLAYERS) return { error: `Need at least ${C.MIN_PLAYERS} players.` };
    const roles = Array(C.wolves(n)).fill('wolf');
    if (this.vampiresOn) for (let i = 0; i < C.vampires(n); i++) roles.push('vampire');
    if (n >= C.SEER_AT) roles.push('seer');
    if (n >= C.HEALER_AT) roles.push('healer');
    if (n >= C.HUNTER_AT) roles.push('hunter');
    while (roles.length < n) roles.push('villager');
    shuffle(roles);
    const quests = shuffle([...T.quests]);
    this.list.forEach((p, i) => {
      p.role = roles[i];
      // The Seer can't vote "the same way as the Seer"; swap that quest out.
      let qi = quests.findIndex(q => !(q.id === 'seer2' && p.role === 'seer'));
      p.quest = quests.splice(qi, 1)[0] || T.pick(T.quests.filter(q => q.id !== 'seer2'));
    });
    this.lines = [];
    this.say(T.pick(T.intro));
    this.say(T.roleReveal);
    this.setPhase('roles', now, C.ROLE_REVEAL);
  }

  setPhase(phase, now, seconds) {
    this.phase = phase;
    this.endsAt = seconds ? now + seconds * 1000 : 0;
    this.touch();
  }

  // ---------- player actions ----------

  // What a player is being asked to do right now, if anything.
  task(p) {
    const others = this.alive.filter(o => o.id !== p.id);
    if (this.phase === 'night') {
      if (!p.alive) return { kind: 'haunt', prompt: 'Pick a living player to haunt. The ghosts will drop a clue about them.', options: this.alive };
      if (p.role === 'wolf') return { kind: 'kill', prompt: 'Pick someone to eat. Agree with your pack.', options: this.alive.filter(o => o.role !== 'wolf') };
      if (p.role === 'vampire') return { kind: 'bite', prompt: 'Pick someone to bite and turn into a Vampire. Agree with your coven.', options: this.alive.filter(o => o.role !== 'vampire') };
      if (p.role === 'seer') return { kind: 'peek', prompt: 'Pick a player to peek at.', options: others };
      if (p.role === 'healer') return { kind: 'protect', prompt: 'Pick a player to protect tonight.', options: this.alive.filter(o => o.id !== this.lastProtected) };
      return { kind: 'decoy', prompt: this.night.decoys[p.id], options: others };
    }
    if (this.phase === 'vote') {
      if (!p.alive) return { kind: 'bet', prompt: 'Ghost bet: who will the village vote out?', options: this.alive };
      return { kind: 'vote', prompt: 'Who should be dragged to the town square?', options: others, canSkip: true };
    }
    if (this.phase === 'hunter' && this.hunter && p.id === this.hunter.id && !this.hunter.picked)
      return { kind: 'shoot', prompt: 'Pick who you take down with you.', options: others };
    return null;
  }

  picked(p) {
    if (this.phase === 'night') return this.night.picks[p.id] ?? null;
    if (this.phase === 'vote') return (p.alive ? this.vote.votes[p.id] : this.vote.bets[p.id]) ?? null;
    return null;
  }

  act(id, action, now) {
    const p = this.players.get(id);
    if (!p || !action) return;
    if (action.type === 'quest') {
      if (this.phase !== 'lobby' && this.phase !== 'over' && p.quest && !p.quest.auto) { p.questClaimed = !p.questClaimed; this.touch(); }
      return;
    }
    const t = this.task(p);
    if (!t) return;
    const target = action.target;
    if (t.kind === 'vote' && target === 'skip') { this.vote.votes[p.id] = 'skip'; return this.afterAct(now); }
    if (!t.options.some(o => o.id === target)) return;
    if (this.phase === 'night') {
      if (this.night.picks[p.id] && t.kind === 'peek') return; // the Seer can't re-peek
      this.night.picks[p.id] = target;
      if (t.kind === 'peek') {
        const o = this.players.get(target);
        p.seerResults.push({ round: this.round, name: o.name, is: o.role === 'wolf' ? 'wolf' : o.role === 'vampire' ? 'vampire' : 'clean' });
      }
    } else if (this.phase === 'vote') {
      if (p.alive) this.vote.votes[p.id] = target; else this.vote.bets[p.id] = target;
    } else if (this.phase === 'hunter') {
      this.hunter.picked = target;
      this.endsAt = now; // resolve straight away
    }
    this.afterAct(now);
  }

  // When everyone has chosen, cut the timer short (with a beat so the last tap doesn't reveal itself).
  afterAct(now) {
    this.touch();
    const everyone = this.list.filter(p => this.task(p));
    if (everyone.length && everyone.every(p => this.picked(p))) this.endsAt = Math.min(this.endsAt, now + 2000);
  }

  // ---------- the clock ----------

  tick(now) {
    if (this.phase === 'day' && this.stallAt && now >= this.stallAt) {
      this.stallAt = 0;
      const target = T.pick(this.alive);
      if (target) this.say(T.fill(T.pick(T.dayStalls), { name: target.name }));
    }
    if (!this.endsAt || now < this.endsAt) return;
    switch (this.phase) {
      case 'roles': return this.startNight(now);
      case 'night': return this.endNight(now);
      case 'morning': return this.afterDeaths('day', now);
      case 'hunter': return this.endHunter(now);
      case 'day': this.say(T.dayEnd); return this.startVote(now);
      case 'vote': return this.endVote(now);
      case 'voteReveal': return this.showVoteResult(now);
      case 'voteResult': return this.afterDeaths('night', now);
    }
  }

  startNight(now) {
    this.round++;
    const decoys = shuffle([...T.decoys]);
    this.night = { picks: {}, decoys: {} };
    this.list.forEach((p, i) => { this.night.decoys[p.id] = decoys[i % decoys.length]; });
    this.say(T.pick(T.nightFalls));
    this.setPhase('night', now, C.NIGHT);
  }

  endNight(now) {
    const picks = this.night.picks;
    const byRole = role => this.alive.filter(p => p.role === role);
    // If the pack never chose, the hungriest wolf grabs someone at random.
    const prey = this.alive.filter(p => p.role !== 'wolf');
    const victim = topPick(byRole('wolf').map(w => picks[w.id])) || (prey.length ? T.pick(prey).id : null);
    const healer = byRole('healer')[0];
    const saved = healer ? picks[healer.id] ?? null : null;
    this.lastProtected = saved;
    const haunted = topPick(this.ghosts.map(g => picks[g.id]));

    this.say(T.pick(T.morning));
    if (victim && victim !== saved) {
      this.kill(victim);
      this.say(T.fill(T.pick(T.deaths), { name: this.name(victim) }));
    } else if (victim) this.say(T.pick(T.saved));
    else this.say(T.pick(T.quietNight));

    this.resolveBite(saved);

    const h = haunted && this.players.get(haunted);
    const clues = h && (h.role === 'wolf' ? T.ghostClueWolf : h.role === 'vampire' ? T.ghostClueVampire : T.ghostClueVillage);
    if (h && h.alive) this.say(T.fill(T.pick(clues), { name: h.name }));
    this.setPhase('morning', now, C.MORNING);
  }

  // The coven's bite: turns one player into a Vampire, unless they died, were protected, or are a Wolf.
  resolveBite(saved) {
    const coven = this.alive.filter(p => p.role === 'vampire');
    const target = this.players.get(topPick(coven.map(v => this.night.picks[v.id])));
    if (!coven.length || !target || !target.alive || target.id === saved) return;
    const note = (list, text) => list.forEach(p => p.notes.push({ round: this.round, text }));
    if (target.role === 'wolf') return note(coven, `Your fangs bounced off ${target.name}. They are a Wolf!`);
    target.role = 'vampire';
    note([target], 'You were bitten in the night! You are a Vampire now. Your coven is on your phone.');
    note(coven, `${target.name} has joined your coven.`);
    const wolves = this.alive.filter(p => p.role === 'wolf');
    if (Math.random() < C.WOLF_SPOT_CHANCE) note(wolves, `You smell fresh blood. ${target.name} was bitten and is now a Vampire!`);
    this.say(T.pick(T.batSeen));
  }

  kill(id) {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    p.alive = false;
    if (p.role === 'hunter') this.hunter = { id, picked: null };
    this.touch();
  }

  // After deaths: a dying Hunter shoots first, then we check for a winner, then carry on.
  afterDeaths(next, now) {
    if (this.hunter && !this.hunter.done) {
      this.hunter.after = next;
      this.say(T.fill(T.hunterRise, { name: this.name(this.hunter.id) }));
      return this.setPhase('hunter', now, C.HUNTER);
    }
    if (this.checkWin(now)) return;
    if (next === 'day') {
      this.say(T.dayStart);
      this.stallAt = now + C.DAY * 450;
      return this.setPhase('day', now, C.DAY);
    }
    this.startNight(now);
  }

  endHunter(now) {
    const h = this.hunter;
    h.done = true;
    const target = h.picked && this.players.get(h.picked);
    if (target && target.alive) {
      this.kill(target.id);
      this.say(T.fill(T.hunterShot, { name: this.name(h.id), target: target.name, role: T.roles[target.role].name }));
    } else this.say(T.fill(T.hunterMissed, { name: this.name(h.id) }));
    const next = h.after;
    // A second Hunter can't exist, so clear it and continue where we were going.
    this.hunter = { ...h, done: true };
    this.afterDeaths(next, now);
  }

  startVote(now) {
    this.vote = { votes: {}, bets: {} };
    this.say(T.voteStart);
    this.setPhase('vote', now, C.VOTE);
  }

  endVote(now) {
    const { votes } = this.vote;
    const voters = this.alive;
    this.reveal = voters.map(p => ({ voter: p.id, target: votes[p.id] || 'skip' }));
    shuffle(this.reveal);
    const out = topPick(voters.map(p => votes[p.id] !== 'skip' ? votes[p.id] : null), true);
    const seer = voters.find(p => p.role === 'seer');
    this.dayVotes.push({
      votes: Object.fromEntries(voters.map(p => [p.id, votes[p.id] || 'skip'])),
      seerVote: seer ? votes[seer.id] || 'skip' : null,
      out,
      hadVotes: voters.some(p => votes[p.id] && votes[p.id] !== 'skip'),
    });
    for (const g of this.ghosts) if (out && this.vote.bets[g.id] === out) g.betPoints++;
    this.voteOut = out;
    this.revealStart = now;
    this.setPhase('voteReveal', now, this.reveal.length * C.VOTE_REVEAL_PER_VOTE + 1.5);
  }

  showVoteResult(now) {
    const out = this.voteOut && this.players.get(this.voteOut);
    const day = this.dayVotes.at(-1);
    if (out) {
      this.kill(out.id);
      const lines = out.role === 'wolf' ? T.voteOutWolf : out.role === 'vampire' ? T.voteOutVampire : T.voteOutVillager;
      this.say(T.fill(T.pick(lines), { name: out.name, role: T.roles[out.role].name }));
    } else this.say(T.pick(day.hadVotes ? T.voteTie : T.voteNobody));
    this.setPhase('voteResult', now, C.VOTE_RESULT);
  }

  checkWin(now) {
    const wolves = this.alive.filter(p => p.role === 'wolf').length;
    const vamps = this.alive.filter(p => p.role === 'vampire').length;
    const others = this.alive.length - wolves - vamps;
    // A team wins once it is the only monster team left and matches everyone else alive.
    if (!wolves && !vamps) this.winner = 'village';
    else if (wolves && !vamps && wolves >= others) this.winner = 'wolves';
    else if (vamps && !wolves && vamps >= others) this.winner = 'vampires';
    else return false;
    this.say({ village: T.villageWins, wolves: T.wolvesWin, vampires: T.vampiresWin }[this.winner]);
    this.say(T.questReveal);
    this.final = this.list.map(p => {
      const questDone = this.questDone(p);
      const won = T.roles[p.role].team === this.winner;
      p.score = (won ? C.POINTS_WIN : 0) + (questDone ? C.POINTS_QUEST : 0) + p.betPoints * C.POINTS_GHOST_BET;
      return { id: p.id, name: p.name, color: p.color, role: p.role, alive: p.alive, quest: p.quest.text, questDone, won, bets: p.betPoints, score: p.score };
    }).sort((a, b) => b.score - a.score);
    this.setPhase('over', now, 0);
    return true;
  }

  questDone(p) {
    const q = p.quest;
    if (!q.auto) return p.questClaimed;
    const mine = this.dayVotes.map(d => d.votes[p.id]).filter(v => v !== undefined);
    switch (q.id) {
      case 'survive': return p.alive;
      case 'seer2': return this.dayVotes.filter(d => d.votes[p.id] && d.votes[p.id] !== 'skip' && d.votes[p.id] === d.seerVote).length >= 2;
      case 'majority': return this.dayVotes.filter(d => d.out && d.votes[p.id] === d.out).length >= 2;
      case 'wolfvote': return mine.some(v => this.players.get(v)?.role === 'wolf');
      case 'neverskip': return mine.length > 0 && mine.every(v => v !== 'skip');
    }
    return false;
  }

  // ---------- what each screen sees ----------

  tvView(now) {
    const showRoles = this.phase === 'over';
    const night = this.phase === 'night', vote = this.phase === 'vote';
    const askers = this.list.filter(p => this.task(p));
    return {
      phase: this.phase, endsAt: this.endsAt, now, round: this.round,
      players: this.list.map(p => ({
        id: p.id, name: p.name, color: p.color, alive: p.alive, connected: p.connected, isBot: p.isBot,
        role: (showRoles || !p.alive) && p.role ? T.roles[p.role].name : null,
      })),
      acted: (night || vote) ? askers.filter(p => this.picked(p)).length : 0,
      toAct: (night || vote) ? askers.length : 0,
      lines: this.lines.slice(-8),
      reveal: (this.phase === 'voteReveal' || this.phase === 'voteResult')
        ? this.reveal.map(r => ({ voter: this.name(r.voter), target: r.target === 'skip' ? null : this.name(r.target) })) : null,
      revealStart: this.revealStart || 0, revealPer: C.VOTE_REVEAL_PER_VOTE,
      voteOut: this.phase === 'voteResult' && this.voteOut ? this.name(this.voteOut) : null,
      hunter: this.phase === 'hunter' ? this.name(this.hunter.id) : null,
      winner: this.winner,
      final: this.final && this.final.map(f => ({ ...f, role: T.roles[f.role].name })),
      minPlayers: C.MIN_PLAYERS, maxPlayers: C.MAX_PLAYERS,
      vampiresOn: this.vampiresOn, vampiresAt: C.VAMPIRES_AT,
    };
  }

  phoneView(id, now) {
    const p = this.players.get(id);
    if (!p) return null;
    const t = this.task(p);
    const role = p.role && T.roles[p.role];
    return {
      phase: this.phase, endsAt: this.endsAt, now, round: this.round,
      me: {
        name: p.name, color: p.color, alive: p.alive,
        role: role ? { key: p.role, ...role } : null,
        quest: p.quest ? { text: p.quest.text, auto: p.quest.auto, claimed: p.questClaimed } : null,
      },
      task: t && { kind: t.kind, prompt: t.prompt, canSkip: !!t.canSkip, options: t.options.map(o => ({ id: o.id, name: o.name, color: o.color })) },
      picked: t ? this.picked(p) : null,
      // Wolves see their pack and Vampires their coven, with each other's picks at night
      team: (p.role === 'wolf' || p.role === 'vampire') ? {
        label: p.role === 'wolf' ? 'Your pack' : 'Your coven',
        members: this.list.filter(o => o.role === p.role && o.id !== p.id).map(o => ({
          name: o.name, alive: o.alive, pick: this.phase === 'night' && this.night.picks[o.id] ? this.name(this.night.picks[o.id]) : null,
        })),
      } : null,
      notes: p.notes,
      seerResults: p.role === 'seer' ? p.seerResults : null,
      final: this.phase === 'over' ? this.final.find(f => f.id === p.id) : null,
      winner: this.winner,
    };
  }
}

module.exports = { Game };
