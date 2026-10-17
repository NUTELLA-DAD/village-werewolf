# Village Werewolf

A spooky-village Werewolf party game for 4 to 16 players (6 or more plays best). The laptop runs
the game and shows it on the TV. Everyone plays on their own phone by scanning a QR code. A voiced
narrator runs the whole game, so nobody has to sit out as the moderator.

## Starting a game

1. Plug the laptop into the TV.
2. Double-click `start.bat`. A black window opens (leave it open) and the TV screen opens in your
   browser. The first run needs internet to install; after that it works offline.
3. Click anywhere on the TV screen once. That lets the narrator speak.
4. Everyone scans the QR code with their phone camera (same Wi-Fi as the laptop) and types a name.
5. Click **Start game**.

Short on people? **Add 4 bots** fills seats with bots that tap random choices, which is handy for
trying it out. Click a name in the lobby to remove it.

TV buttons: **Skip timer** ends the current countdown, **Voice** turns the narrator on or off
(captions stay on), and **New game** goes back to the lobby with everyone still joined.

## How it plays

- **Roles:** at 16 players there are 3 Wolves, a Seer, a Healer, a Hunter and 10 Villagers.
  Smaller groups get fewer Wolves (2 at 8 to 11 players, 1 below 8).
- **Side quests:** everyone also gets a secret side quest worth bonus points, revealed at the end.
  Some are checked by the game; for the others, tap **I did my side quest** on your phone.
- **Night (30 s):** every phone asks for a tap, so nobody can tell who has a power. Wolves pick
  someone to eat, the Seer peeks at a player, the Healer protects one, and everyone else answers a
  silly decoy question.
- **Morning:** the narrator tells the death story. Ghosts may leave a clue.
- **Day (3 min):** argue out loud.
- **Vote (25 s):** tap a name or skip. The TV reveals the votes one by one. A tie means nobody goes.
- **Hunter:** when the Hunter dies, they take one player down with them.
- **Ghosts:** dead players can't talk, but each night they pick someone to haunt (which gives the
  village a clue about that player) and they bet on each day's vote.
- **Winning:** the Village wins when every Wolf is gone. The Wolves win when they match the living
  villagers in number. Scores: winning team +3, side quest +2, each right ghost bet +1.

If a phone refreshes or drops, it rejoins its seat by itself. A new phone can take over a seat by
typing the same name.

## For tinkering

- All timers and role counts: `config.js`.
- Everything the narrator says, the side quests and the decoy questions: `content.js`.
- Game rules: `game.js`. Server: `server.js`. TV: `public/tv.*`. Phone: `public/play.*`.
- `npm test` plays 300 full bot games of every size and checks that each one ends cleanly.
