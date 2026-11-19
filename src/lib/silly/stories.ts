// The first 10 Silly Stories (her request 2026-11-19: "Mad Lib style silly story fill in the blank ... regular Mad Libs
// size. Let's start with 10 stories ... a day at the dog park, life as a lizard, and variety of different things. Don't
// have any that are specific to public school"). Each story is ordinary prose: the Symbolic Grammar Engine finds its
// nouns, verbs, adjectives and adverbs, and the teacher's settings decide how many of each become blanks. A word in
// brackets, like [noun], is always a blank.

export type BlankKind = 'noun' | 'pluralNoun' | 'verb' | 'adjective' | 'adverb' | 'number';
export type BlankCounts = Partial<Record<BlankKind, number>>;
export interface StarterStory { id: string; title: string; text: string; counts: BlankCounts }

export const DEFAULT_COUNTS: BlankCounts = { adjective: 4, noun: 3, pluralNoun: 2, verb: 3, adverb: 1, number: 1 };

export const STARTER_STORIES: StarterStory[] = [
  {
    id: 'dog-park', title: 'A Day at the Dog Park', counts: DEFAULT_COUNTS,
    text: `On a sunny Saturday, I took my fluffy dog to the dog park. The moment we walked through the gate, she ran straight to a muddy puddle and jumped in with all four paws. A tiny poodle barked loudly at a squirrel, and a big golden dog chased a red ball across the grass. My dog made friends with a spotted puppy who carried a stick that was longer than a car. They wrestled and rolled until they were both covered in leaves. Then a man opened a bag of crunchy treats, and twelve dogs sat down at the same time. My dog did a perfect spin and got three treats. When it was time to go home, she lay down on the soft grass and refused to move. I had to carry her to the car like a sleepy baby. It was the best day ever.`,
  },
  {
    id: 'lizard', title: 'Life as a Lizard', counts: DEFAULT_COUNTS,
    text: `I woke up one morning and found out I was a green lizard. My skin was bumpy and my tail was very long. First, I climbed up a warm rock and sat in the bright sun for two hours. Then I got hungry, so I flicked out my sticky tongue and caught a crunchy cricket. It tasted like a salty pretzel. A hungry bird flew over me, so I quickly hid under a flat leaf. When the bird left, I raced across the hot sand and climbed a tall cactus. From the top, I could see a sleepy turtle and a family of noisy frogs. At night, I curled up in a cozy crack in the rocks. Being a lizard is a strange life, but I could get used to all that sunshine.`,
  },
  {
    id: 'camping', title: 'The Camping Trip', counts: DEFAULT_COUNTS,
    text: `Last summer, my family went camping in a quiet forest. We drove for five hours with a canoe tied to the roof of the car. When we got there, my dad tried to set up the tent, but it fell down three times. My little brother laughed so hard that he snorted. At night, we built a warm fire and cooked gooey marshmallows on long sticks. Mine caught on fire and turned as black as a rock, but it still tasted sweet. An owl hooted in a tall tree, and a curious raccoon crept close to our cooler. My mom told a funny story about a bear who loved pancakes. In the morning, we paddled the canoe across a calm lake and saw a moose eating plants. It was a wild and wonderful trip.`,
  },
  {
    id: 'space', title: 'A Trip to Outer Space', counts: DEFAULT_COUNTS,
    text: `Today, I became the first kid to fly a rocket to the moon. I put on a shiny helmet and climbed into the tiny seat. The captain counted down from ten, and the rocket blasted into the dark sky. Out the window, I saw a bright planet with purple rings and a comet with a long glowing tail. Inside the rocket, everything floated. My sandwich drifted past my nose, and my juice turned into wobbly bubbles. When we landed on the moon, I hopped slowly across the dusty ground. I found a smooth rock that sparkled like glitter. Suddenly, a friendly alien waved at me from behind a crater. It had seven eyes and wore a silly hat. We traded snacks and laughed together. Then I flew home with the best souvenir ever.`,
  },
  {
    id: 'robot-chef', title: 'The Robot Chef', counts: DEFAULT_COUNTS,
    text: `My neighbor built a robot that could cook any meal. On Sunday, she invited me over to taste its food. The robot had silver arms, blinking lights, and a tall white hat. First, it cracked six eggs into a giant bowl and stirred them quickly. Then it tossed a pancake so high that it stuck to the ceiling. The robot beeped happily and made another one. For lunch, it cooked spaghetti with meatballs as big as baseballs. The sauce splashed all over the kitchen, and the cat licked the floor clean. For dessert, the robot baked a chocolate cake with nine layers and sprinkles on top. It tasted amazing. Before I left, the robot handed me a crunchy cookie and said, "Come back soon." I cannot wait to eat there again.`,
  },
  {
    id: 'under-sea', title: 'Under the Sea', counts: DEFAULT_COUNTS,
    text: `I put on my flippers and a big mask and dove into the clear blue ocean. Right away, a school of yellow fish swam past my face. A shy octopus peeked out from behind a colorful coral and changed its color to match the rocks. I swam deeper and found a sunken ship covered in green seaweed. Inside, there was an old chest full of shiny coins and a rusty spoon. A friendly dolphin swam up and nudged my arm, so I held onto its fin. We zoomed through the water faster than a speedboat. Then a giant whale sang a deep song that made the water tremble. Four sea turtles floated by, slowly flapping their flippers. When I swam back to the beach, I was tired and happy, and I had sand in my ears for a week.`,
  },
  {
    id: 'grocery', title: 'The Grocery Store Adventure', counts: DEFAULT_COUNTS,
    text: `My grandma asked me to help her buy groceries, so we grabbed a squeaky cart and went inside. The first thing I saw was a mountain of round oranges. I carefully took one from the bottom, and the whole pile rolled across the floor. A worker chased them down the aisle while I said sorry eight times. Next, we picked out crunchy cereal, a bunch of bananas, and a block of stinky cheese. In the frozen aisle, my glasses fogged up so much that I walked straight into a giant pickle display. Grandma laughed and bought the biggest pickle in the jar. At the checkout, the cashier gave me a sticker shaped like a carrot. On the way home, we ate warm bread from the bakery. Shopping with Grandma is always an adventure.`,
  },
  {
    id: 'pet-dragon', title: 'My Pet Dragon', counts: DEFAULT_COUNTS,
    text: `I found a strange egg in my backyard, and the next morning it cracked open. Out came a tiny purple dragon with sparkly wings. I named him Pickles. At first, he was as small as a kitten, but every day he grew bigger. He loved to eat spicy peppers and warm toast. When he sneezed, little puffs of smoke came out of his nose. One day, he flew over the roof and scared a flock of pigeons. My neighbors stared at the sky with open mouths. Pickles is gentle and sweet. He helps me roast marshmallows and keeps my feet warm at night. Now he is as big as a bus, so he sleeps in the garage. Taking care of a dragon is a lot of work, but he is the best pet in the whole world.`,
  },
  {
    id: 'picnic', title: 'The Big Family Picnic', counts: DEFAULT_COUNTS,
    text: `Every summer, my whole family has a giant picnic at the park by the river. This year, my uncle brought a cooler full of cold lemonade and a watermelon as big as a tire. My cousins and I played tag on the soft grass until we were too tired to run. Then we sat on a checkered blanket and ate crispy chicken, salty chips, and a mountain of potato salad. A sneaky squirrel stole a cookie right off my plate and ran up a tree. My aunt chased it, waving her arms and shouting. After lunch, we had a three legged race, and I tripped over my own feet. Everybody laughed, even me. At sunset, we watched fireflies blink in the dark. It was a long, happy, and noisy day.`,
  },
  {
    id: 'missing-socks', title: 'The Mystery of the Missing Socks', counts: DEFAULT_COUNTS,
    text: `Every week, my socks disappear from the laundry basket. I decided to solve the mystery. I put on a detective hat, grabbed a magnifying glass, and searched the whole house. Under the couch, I found two crumbs, a lost button, and a very dusty marble. Behind the washing machine, I found a tiny trail of fuzzy lint. I followed it quietly down the hall and into the closet. There, sitting in a cozy pile of my socks, was our fluffy cat. She had built a soft nest and was sleeping like a queen. Next to her were five little kittens, each one curled up inside a striped sock. I gasped and smiled at the same time. The mystery was solved. Now I buy socks in packs of twenty.`,
  },
];
