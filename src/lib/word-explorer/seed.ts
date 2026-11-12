import type { PartOfSpeech, Tier } from './types';

// Starter entries drafted in her definition style (spec section 11) so she can see the two-layer format on real
// words. Every one is a DRAFT: students do not see it until she approves it in Teacher view. Formula codes are left
// empty until she sends her formula code list (spec section 13, open decision 1).
// `oewn` links a drafted meaning to the WordNet meaning it matches, so it borrows that meaning's synonyms,
// opposites and word family.

export interface SeedSense {
  signpost: string;
  pos: PartOfSpeech;
  definition: string;
  explanation: string;
  examples: string[];
  patterns?: string[];
  countable?: boolean;
  needsObject?: boolean;
  oewn?: string;
  synonyms?: string[];   // drafted thesaurus words for this meaning, closest first
  antonyms?: string[];
}
export interface SeedEntry { soundOut?: string; tier?: Tier; senses: SeedSense[] }

export const SEED_ENTRIES: Record<string, SeedEntry> = {
  happy: {
    soundOut: 'HAP-ee', tier: 1,
    senses: [{
      signpost: 'feeling glad', pos: 'adjective', oewn: 'oewn-happy__3.00.00..',
      synonyms: ['glad', 'cheerful', 'joyful', 'pleased', 'delighted', 'content'], antonyms: ['sad', 'unhappy'],
      definition: 'feeling glad and good inside',
      explanation: 'When you are happy, you feel good. You might smile or laugh.',
      examples: ['I am happy.', 'The players were happy after the game.', 'She will be happy to see her friend.'],
      patterns: ['happy to + verb', 'happy about + noun', 'happy for + someone'],
    }],
  },
  sad: {
    soundOut: 'SAD', tier: 1,
    senses: [{
      signpost: 'feeling unhappy', pos: 'adjective', oewn: 'oewn-sad__3.00.00..',
      synonyms: ['unhappy', 'upset', 'gloomy', 'miserable', 'down'], antonyms: ['happy', 'glad'],
      definition: 'feeling unhappy, often because something went wrong',
      explanation: 'When you are sad, you do not feel good inside. You might want to cry or be quiet.',
      examples: ['He was sad when the game ended.', 'The movie is sad.', 'We will be sad to leave.'],
      patterns: ['sad about + noun', 'sad to + verb'],
    }],
  },
  curious: {
    soundOut: 'KYUR-ee-us', tier: 2,
    senses: [{
      signpost: 'wanting to know', pos: 'adjective', oewn: 'oewn-curious__3.00.00..',
      synonyms: ['interested', 'inquisitive', 'nosy'], antonyms: ['bored', 'uninterested'],
      definition: 'wanting to know or learn about something',
      explanation: 'If you are curious, you want to find out more. You ask questions and look closely.',
      examples: ['The cat is curious.', 'I was curious about the new job.', 'Students will be curious about the rocks.'],
      patterns: ['curious about + noun', 'curious to + verb'],
    }, {
      signpost: 'strange', pos: 'adjective', oewn: 'oewn-curious__5.00.00.strange.00',
      definition: 'strange or not what you expect',
      explanation: 'If something is curious, it is a little odd. It makes you wonder about it.',
      examples: ['We heard a curious sound.', 'The old map had a curious shape.'],
    }],
  },
  run: {
    soundOut: 'RUN', tier: 1,
    senses: [{
      signpost: 'move fast on your feet', pos: 'verb', oewn: 'oewn-run__2.38.00..', needsObject: false,
      synonyms: ['sprint', 'jog', 'race', 'dash', 'hurry'], antonyms: ['walk'],
      definition: 'to move fast on your feet, faster than walking',
      explanation: 'When you run, your legs move fast. Both feet leave the ground for a moment with each step.',
      examples: ['The dog ran to the park.', 'I run every morning.', 'We will run in the race.'],
      patterns: ['run to + place', 'run after + someone'],
    }, {
      signpost: 'be in charge of', pos: 'verb', needsObject: true,
      definition: 'to be in charge of something, like a business or a group',
      explanation: 'If you run a store, you make the plans and keep it going.',
      examples: ['She runs a bakery.', 'He ran the meeting.'],
    }, {
      signpost: 'a time of running', pos: 'noun', oewn: 'oewn-run__1.11.02..', countable: true,
      definition: 'a time when you run, often for exercise',
      explanation: 'A run is the time you spend running. You can go for a run.',
      examples: ['We went for a run.', 'The run was long.'],
    }],
  },
  jump: {
    soundOut: 'JUMP', tier: 1,
    senses: [{
      signpost: 'push off the ground', pos: 'verb', oewn: 'oewn-jump__2.38.00..',
      synonyms: ['leap', 'hop', 'bounce', 'spring'],
      definition: 'to push off the ground with your legs so your body goes up in the air',
      explanation: 'When you jump, your feet leave the ground. Then you land again.',
      examples: ['They jump on the trampoline.', 'The frog jumped into the pond.', 'I will jump over the puddle.'],
      patterns: ['jump over + noun', 'jump into + noun'],
    }],
  },
  brave: {
    soundOut: 'BRAYV', tier: 2,
    senses: [{
      signpost: 'not stopped by fear', pos: 'adjective', oewn: 'oewn-brave__3.00.00..',
      synonyms: ['courageous', 'bold', 'fearless', 'daring'], antonyms: ['scared', 'cowardly'],
      definition: 'ready to do something hard or scary',
      explanation: 'If you are brave, you feel afraid but you do the hard thing anyway.',
      examples: ['The firefighter was brave.', 'You are brave to try again.', 'She will be brave at the doctor.'],
      patterns: ['brave to + verb'],
    }],
  },
  friend: {
    soundOut: 'FREND', tier: 1,
    senses: [{
      signpost: 'a person you like', pos: 'noun', oewn: 'oewn-friend__1.18.00..', countable: true,
      synonyms: ['pal', 'buddy', 'companion', 'classmate'], antonyms: ['enemy'],
      definition: 'a person you know well, like, and trust',
      explanation: 'A friend is someone you like to spend time with. Friends help each other.',
      examples: ['My friend helped me.', 'Sam is a good friend.', 'We will meet our friends at lunch.'],
      patterns: ['a friend of + someone', 'friends with + someone'],
    }],
  },
  rainbow: {
    soundOut: 'RAYN-boh', tier: 1,
    senses: [{
      signpost: 'colors in the sky', pos: 'noun', oewn: 'oewn-rainbow__1.17.00..', countable: true,
      definition: 'a curved band of colors in the sky, made when sunlight shines through rain',
      explanation: 'You can see a rainbow when the sun comes out during or after rain. It has red, orange, yellow, green, blue and purple.',
      examples: ['A rainbow appeared after the storm.', 'The rainbow is bright.', 'We saw a rainbow over the lake.'],
    }],
  },
  quick: {
    soundOut: 'KWIK', tier: 1,
    senses: [{
      signpost: 'fast', pos: 'adjective', oewn: 'oewn-quick__5.00.00.fast.01',
      synonyms: ['fast', 'speedy', 'rapid', 'swift'], antonyms: ['slow'],
      definition: 'fast, or taking only a short time',
      explanation: 'If something is quick, it does not take long.',
      examples: ['We ate a quick lunch.', 'The rabbit is quick.', 'It was a quick trip to the store.'],
    }],
  },
  help: {
    soundOut: 'HELP', tier: 1,
    senses: [{
      signpost: 'make something easier', pos: 'verb', oewn: 'oewn-help__2.41.00..', needsObject: true,
      synonyms: ['assist', 'aid', 'support'], antonyms: ['hinder'],
      definition: 'to do something that makes a job easier for someone',
      explanation: 'When you help, you do part of the work so it is easier for someone else.',
      examples: ['I helped my dad with the dishes.', 'She helps her team.', 'We will help the new student.'],
      patterns: ['help + someone + verb', 'help with + noun'],
    }, {
      signpost: 'what someone gives', pos: 'noun', oewn: 'oewn-help__1.04.00..', countable: false,
      definition: 'something you do or give to make a job easier',
      explanation: 'Help is what you give someone when they need it.',
      examples: ['Thank you for your help.', 'He asked for help.'],
    }],
  },
};
