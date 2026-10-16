// Every tunable number in one place (seconds unless noted).
module.exports = {
  MAX_PLAYERS: 16,
  MIN_PLAYERS: 4,          // 6 or more plays best
  ROLE_REVEAL: 15,         // time to peek at your role before the first night
  NIGHT: 30,
  MORNING: 18,             // death story + ghost clue
  HUNTER: 20,              // a dying Hunter picks who to take down
  DAY: 180,
  VOTE: 25,
  VOTE_REVEAL_PER_VOTE: 0.9, // TV reveals one vote at a time
  VOTE_RESULT: 9,
  // Wolves by player count
  wolves: n => (n >= 12 ? 3 : n >= 8 ? 2 : 1),
  // Special villagers switch on as the group grows
  SEER_AT: 4, HEALER_AT: 6, HUNTER_AT: 7,
  // Scoring for the final scoreboard
  POINTS_WIN: 3, POINTS_QUEST: 2, POINTS_GHOST_BET: 1,
};
