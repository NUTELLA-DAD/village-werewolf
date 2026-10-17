// Everything the narrator says, plus side quests and decoy prompts.
// {name} is replaced with a player's name. Keep it silly, PG to PG-13.

const pick = list => list[Math.floor(Math.random() * list.length)];
const fill = (line, vars) => line.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

module.exports = { pick, fill,

  intro: [
    'Welcome, villagers, to the cursed little village of Hollowmere. Population: shrinking.',
    'Gather round, villagers. I am the village elder, and I have terrible news. Wolves walk among you.',
  ],

  roleReveal: 'Check your phone, and keep it secret. Hold the card to peek at your role and your side quest.',

  nightFalls: [
    'Night falls on the village. Everyone, look at your phone and make your choice. Quietly.',
    'The moon rises. Somewhere, a wolf is licking its lips. Everyone, tap your phone.',
    'Darkness. Crickets. A suspicious howl. Phones out, everyone, and keep them hidden.',
  ],

  deaths: [
    '{name} was found in the pumpkin patch, wearing only one boot and a look of deep regret.',
    '{name} went out for a midnight snack, and became one.',
    'All that remains of {name} is a slipper and a very guilty-looking trail of paw prints.',
    '{name} was found face down in the pudding. The pudding is fine.',
    '{name} tried to pet the big fluffy dog. It was not a dog.',
    'The wolves dragged {name} into the woods. We heard screaming, then chewing, then a burp.',
    '{name} was eaten so thoroughly that only their terrible haircut survived.',
    '{name} stepped outside to check on a strange noise. Classic mistake, {name}.',
    'We found {name} hanging upside down from the well, which is not how wells work.',
    '{name} has been reduced to a pile of bones and one sad sock.',
    '{name} was found in the bakery, half eaten, like a croissant.',
    'The wolves got {name}. In their defense, {name} did smell a lot like bacon.',
  ],

  saved: [
    'Good morning! Nobody died. The Healer was busy last night, and somebody out there is very annoyed about it.',
    'A miracle! The wolves attacked, but someone was patched up just in time. Everyone lives. For now.',
    'The wolves came, the wolves bit, and the Healer said: absolutely not.',
  ],

  batSeen: [
    'Also, a bat was seen fluttering over the village last night. Probably nothing. Probably.',
    'Someone in the village woke up with two tiny holes in their neck and a sudden hatred of garlic.',
    'Strange news: the blacksmith reports his garlic has been stolen. All of it.',
  ],

  quietNight: [
    'The night passes quietly. Too quietly. The wolves could not agree on a snack.',
  ],

  morning: [
    'Good morning, village! Well, mostly.',
    'The rooster crows. The village wakes. Most of it.',
    'Rise and shine, villagers. Let us count heads.',
  ],

  ghostClueWolf: [
    'The ghosts whisper that {name} has a little too much fur in their hairbrush.',
    'The ghosts sense that {name}\'s hands smell faintly of wet dog.',
    'The ghosts noticed {name} growling at the moon last night.',
    'The ghosts report that {name} has very pointy teeth for someone who claims to be a baker.',
  ],
  ghostClueVampire: [
    'The ghosts whisper that {name} has no reflection in the pond.',
    'The ghosts sense that {name} hissed at a clove of garlic.',
    'The ghosts noticed {name} sleeping upside down in the barn.',
  ],
  ghostClueVillage: [
    'The ghosts whisper that {name} slept like a baby, and snored like a walrus.',
    'The ghosts sense that {name} is far too boring to be a wolf.',
    'The ghosts report that {name} was knitting all night. Wolves cannot knit.',
    'The ghosts noticed {name} is afraid of a squirrel. Very un-wolf.',
  ],

  dayStart: 'The village gathers in the square. You have three minutes. Argue. Accuse. Lie, if you must.',
  dayStalls: [
    'Nobody has accused {name} yet. Suspicious, {name}.',
    'I notice {name} has gone very quiet.',
    '{name}, you look nervous. Care to explain yourself?',
    'Come now, villagers. Someone here is a wolf, and it might be {name}.',
  ],
  dayEnd: 'Time is up! Grab your phones and vote.',

  voteStart: 'Everyone vote! Who gets dragged to the town square?',

  voteOutWolf: [
    'The village has spoken. {name} is dragged to the town square, and they were a Wolf! Good job, village.',
    '{name} is chased out of town. Underneath the fake mustache: fur. A Wolf! Nicely done.',
  ],
  voteOutVampire: [
    'The village has spoken. {name} is dragged into the sunlight, and they sizzle! A Vampire!',
    '{name} is chased out of town, and a bat flies out of their hat. A Vampire! Nicely done.',
  ],
  voteOutVillager: [
    'The village has spoken. {name} is dragged to the town square. They were... a perfectly innocent {role}. Oops.',
    '{name} is chased out of town with pitchforks. They were the {role}. Awkward.',
  ],
  voteTie: [
    'A tie! The village argues so long that everyone forgets what they were voting for. Nobody leaves.',
  ],
  voteNobody: [
    'Nobody voted for anybody. Brave. Lazy, but brave.',
  ],

  hunterRise: '{name} was the Hunter! With their final breath, they raise their crossbow. {name}, pick your target.',
  hunterShot: '{name} takes {target} down with them. {target} was the {role}.',
  hunterMissed: '{name} fumbled the crossbow and shot a chicken. The chicken was not a wolf.',

  villageWins: 'The last wolf is gone! The village of Hollowmere is safe. Mostly. Village wins!',
  wolvesWin: 'The wolves now rule Hollowmere. Pass the ketchup. Wolves win!',
  vampiresWin: 'The village is now a very pale, very quiet place. The Vampires win!',
  questReveal: 'Now, let us reveal everyone\'s secret side quests.',

  // Side quests. auto = checked by the game; honor = the player taps "Did it!"
  quests: [
    { id: 'survive', text: 'Survive to the very end of the game.', auto: true },
    { id: 'seer2', text: 'Vote the same way as the Seer in two day votes.', auto: true },
    { id: 'majority', text: 'Vote with the winning side in two day votes.', auto: true },
    { id: 'wolfvote', text: 'Vote for a Wolf in a day vote.', auto: true },
    { id: 'neverskip', text: 'Vote for someone in every day vote while you are alive. No skipping.', auto: true },
    { id: 'suspicious', text: 'Get someone to call you suspicious, out loud.', auto: false },
    { id: 'accuse3', text: 'Accuse the same player three days in a row.', auto: false },
    { id: 'firstword', text: 'Be the first to speak on two mornings.', auto: false },
    { id: 'rhyme', text: 'Make an accusation that rhymes.', auto: false },
    { id: 'alibi', text: 'Give a ridiculous alibi, and stick to it.', auto: false },
    { id: 'defend', text: 'Defend someone who turns out to be a Wolf.', auto: false },
    { id: 'accent', text: 'Speak in a fancy accent for a whole day round, and nobody may call you out.', auto: false },
    { id: 'nickname', text: 'Give another player a nickname that the group starts using.', auto: false },
    { id: 'gasp', text: 'Gasp dramatically at every morning announcement.', auto: false },
    { id: 'pointing', text: 'Point at the real culprit while saying "I just have a feeling".', auto: false },
    { id: 'swear', text: 'Swear on your grandma that you are innocent, at least twice.', auto: false },
  ],

  // Decoy prompts so every phone is busy at night
  decoys: [
    'Who would you trust with your sandwich?',
    'Who would survive longest in a haunted house?',
    'Who here snores the loudest?',
    'Who would be the worst at keeping a secret?',
    'Who would you want on your side in a pillow fight?',
    'Who probably talks to their plants?',
    'Who would get lost in their own village?',
    'Who has the most suspicious eyebrows?',
  ],

  roles: {
    wolf: { name: 'Wolf', team: 'wolves', blurb: 'Each night, agree with the other Wolves on one player to eat. Sometimes you smell who the Vampires turned. Blend in during the day.' },
    vampire: { name: 'Vampire', team: 'vampires', blurb: 'Each night, bite one player to turn them into a Vampire too. Wolves can\'t be turned, and the Wolves might smell what you did. Win when the Vampires match everyone else.' },
    seer: { name: 'Seer', team: 'village', blurb: 'Each night, peek at one player to learn if they are a Wolf, a Vampire, or neither. Careful who you tell.' },
    healer: { name: 'Healer', team: 'village', blurb: 'Each night, protect one player from Wolves and Vampire bites. Yourself is fine, but never the same person twice in a row.' },
    hunter: { name: 'Hunter', team: 'village', blurb: 'If you die, by night or by vote, you instantly take one player down with you.' },
    villager: { name: 'Villager', team: 'village', blurb: 'No powers, just your wits. Find the Wolves and vote them out.' },
  },
};
