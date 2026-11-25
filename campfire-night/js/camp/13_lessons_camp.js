// © 2026 George Moussa. All rights reserved.
// CAMP 13. LESSONS: the camp. Field guide pages for everything the night already lets you do (fire, wood, smoke,
//     marshmallows, the tent, stones, fishing, crickets, the owl, breath, mist, dawn). Each unlocks from an event a
//     module emits or a check of the night (see 12_field_guide.js for the lesson shape). Sky pages: 14_lessons_sky.js.
//     Every line was checked before it landed: README "Facts checked". Keep pages short: three sentences at most.
(function () {
  if (!window.Camp || !Camp.lesson) return;
  const C = Camp, L = C.lesson;
  const near = (p, r) => p && Math.hypot(camera.position.x - p.x, camera.position.z - p.z) < r;
  let feeds = 0, owls = 0;
  C.on('night', () => { feeds = 0; owls = 0; });
  C.on('feed', () => { feeds++; });

  // --- Fire ---
  L({ id: 'fire-triangle', topic: 'Fire', title: 'The fire triangle',
    body: 'A fire needs three things: heat, fuel and oxygen. Take any one away and it goes out. Building, feeding and putting out a campfire all come back to this.',
    tryIt: 'keep it fed with sticks from the edge of the clearing.', hint: 'Light the fire and give it a moment.', check: () => C.state.minutes > 4 });
  L({ id: 'kindling', topic: 'Fire', title: 'Why small sticks first',
    body: 'Thin sticks catch quickly: they have a lot of surface for their weight, so they heat through fast. That is why you start a fire with twigs and kindling and only then add thicker wood.',
    hint: 'Feed the fire a stick.', on: 'feed', when: (d) => !d.log });
  L({ id: 'logs', topic: 'Fire', title: 'Why logs last',
    body: 'A log has little surface for its weight, so it heats slowly and burns for hours. Add logs once there is a good bed of coals, or they can smother the flames.',
    hint: 'Carry a log to the fire.', on: 'feed', when: (d) => d.log });
  L({ id: 'poke', topic: 'Fire', title: 'Stirring the fire',
    body: 'Poking pushes the burning pieces together and lets fresh air in underneath, so the flames jump with the extra oxygen and a tired fire comes back. Overdo it and you only scatter the coals.',
    hint: 'Poke the fire (F near the pit).', on: 'poke', when: (d) => !d.embers });
  L({ id: 'flame-colour', topic: 'Fire', title: 'What colour is a flame?',
    body: 'The yellow and orange come from tiny specks of soot glowing hot inside the flame. Where a flame burns blue, the fuel is burning cleanly with plenty of air.',
    hint: 'Stand close to a strong fire for a while.', check: () => C.dFire() < 2.6 && C.fireLevel() > 0.7 && C.state.minutes > 25 });
  L({ id: 'green-wood', topic: 'Fire', title: 'The hiss in the wood',
    body: 'That hiss is water boiling out of the wood. Freshly cut wood can be around half water by weight; dry, seasoned wood burns hotter and with far less smoke.',
    hint: 'Keep feeding the fire.', check: () => feeds >= 3 });
  L({ id: 'smoke', topic: 'Fire', title: 'Does smoke follow you?',
    body: 'Smoke goes where the air goes: the breeze carries it, and the fire pulls air in from every side. Stepping upwind works better than waiting it out. Wood smoke is fine particles, hard on your lungs.',
    hint: 'Spend some time close to the fire.', check: () => C.dFire() < 3 && C.state.minutes > 45 });
  L({ id: 'embers', topic: 'Fire', title: 'Embers',
    body: 'Embers glow without flames: what is left is mostly charcoal, burning slowly on its surface. A bed of glowing coals gives a steady heat, which is why coals, not flames, are best for cooking.',
    tryIt: 'toast a marshmallow over them.',
    hint: 'Let the flames die down to embers once.', on: 'embers' });
  L({ id: 'wind-fire', topic: 'Fire', safety: true, title: 'Fire and wind',
    body: 'Wind feeds a fire and carries its sparks. Keep a campfire small, in a ring of stones on bare ground cleared about 3 metres across, with water close by, and never leave it alone.',
    hint: 'Wait for a gust of wind by the fire.', check: () => C.state.wind > 1.25 && C.dFire() < 5 });
  L({ id: 'drown-stir-feel', topic: 'Fire', safety: true, title: 'Drown, stir, feel',
    body: 'A fire that looks dead can hide hot coals for hours, even under ash. Before you sleep or leave, drown it with water, stir the ashes, drown it again, and only go when it is cool to the back of your hand. Never bury it: buried coals can smoulder and spread.',
    hint: 'Let the fire go out, or stay up until just before dawn.', on: 'fireout', check: () => C.state.minutes > 470 });
  L({ id: 'fire-before-dawn', topic: 'Fire', title: 'Banking the fire',
    body: 'Old campers bank a fire at night: they rake the coals together and cover them with ash, which slows the burning so the coals stay alive until morning. Then a few twigs bring it back.',
    hint: 'Keep a fire going late into the night.', check: () => C.state.minutes > 420 && C.state.fuel > 0 });

  // --- Camp craft ---
  L({ id: 'marshmallow', topic: 'Camp craft', title: 'Toasting',
    body: 'The golden crust is sugar caramelising, with a little browning from the gelatine\'s protein. Toast over glowing coals, not tall flames: coals give an even heat that browns it without setting it alight.',
    hint: 'Sit on the stump and toast a marshmallow (R).', on: 'mallow' });
  L({ id: 'mallow-fire', topic: 'Camp craft', safety: true, title: 'When sugar burns',
    body: 'If a marshmallow catches, blow it out. Don\'t wave the stick around: a flaming blob can fly off. Let it cool a moment too, melted sugar stays hot enough to burn.',
    hint: 'Hold a marshmallow too close for too long.', on: 'mallowfire' });
  L({ id: 'tent-pitch', topic: 'Camp craft', safety: true, title: 'Pitching a tent',
    body: 'Guy lines pull the fabric tight so it sheds rain and stops flapping in the wind. Pitch on flat, slightly raised ground, and look up first: never under dead branches, which campers call widowmakers.',
    hint: 'Walk over to the tent.', check: () => near(C.tentAt, 3.2) });
  L({ id: 'ground-cold', topic: 'Camp craft', title: 'The cold comes from below',
    body: 'The ground pulls heat from your body much faster than air does, so what is under you matters as much as what is over you. A sleeping pad is insulation, not just padding.',
    hint: 'Visit the tent again later in the night.', check: () => near(C.tentAt, 3.2) && C.guide.learned('tent-pitch') && C.state.minutes > 200 });

  // --- Water ---
  L({ id: 'skip-angle', topic: 'Water', title: 'The 20° trick',
    body: 'Physicists who fired spinning discs at water found the best tilt is about 20° between stone and water. A flat, fast throw skims; a steep or slow one digs in and sinks.',
    tryIt: 'look level with the water and throw at full power.', hint: 'Skip a stone at the shore (hold E, let go).', on: 'stone', when: (d) => d.skips >= 1 });
  L({ id: 'skip-spin', topic: 'Water', title: 'Spin and the record',
    body: 'Spin keeps a stone level, like a gyroscope; without it the stone tips and digs in. The world record is 88 skips, thrown by Kurt Steiner in Pennsylvania in 2013.',
    hint: 'Get five skips or more from one stone.', on: 'stone', when: (d) => d.skips >= 5 });
  L({ id: 'catch-release', topic: 'Water', title: 'Letting a fish go',
    body: 'To release a fish kindly, wet your hands first, keep it in or over the water, and let it go quickly. Dry hands rub off the slime coat that protects its skin.',
    hint: 'Catch a fish (C at the shore).', on: 'fish' });
  L({ id: 'perch', topic: 'Water', title: 'Perch',
    body: 'Perch wear dark vertical stripes that break up their outline among the weeds. Hold one with care: the front fin on its back is a row of sharp spines.',
    hint: 'Catch a perch.', on: 'fish', when: (d) => d.name === 'perch' });
  L({ id: 'trout', topic: 'Water', title: 'Trout',
    body: 'Trout need cold, clean water rich in oxygen, so finding them is a good sign for a lake or stream. Like many fish, they feed most at dawn and dusk.',
    hint: 'Catch a trout (they like the hours near dawn).', on: 'fish', when: (d) => d.name === 'trout' });
  L({ id: 'carp', topic: 'Water', title: 'Carp',
    body: 'Carp root through the mud for food, feeling for it with short whisker-like barbels by the mouth. They are tough, slow-growing fish that can live for decades.',
    hint: 'Catch a carp (later in the night).', on: 'fish', when: (d) => d.name === 'carp' });
  L({ id: 'catfish', topic: 'Water', title: 'Catfish',
    body: 'A catfish tastes with its whole body: it has taste buds all over its skin, and a large one can have well over 100,000. It can find food in dark, muddy water by taste alone.',
    hint: 'Catch a catfish (deep in the night).', on: 'fish', when: (d) => d.name === 'catfish' });

  // --- Night life ---
  L({ id: 'crickets', topic: 'Night life', title: 'A cricket thermometer',
    body: 'Crickets chirp faster when it is warm. Count the chirps of one cricket for 25 seconds, divide by 3 and add 4: that is roughly the temperature in °C (or count 14 seconds and add 40 for °F). Only the males sing, by rubbing their wings together.',
    tryIt: 'count the loudest cricket, on your left, then check the Air row top left. Later in the night they slow down, and in the cold they stop.', hint: 'Listen once the night has begun.', check: () => C.state.minutes > 12 });
  L({ id: 'owl', topic: 'Night life', title: 'The owl',
    body: 'That is a tawny owl. The long "hoo… hoo-hoo-hooo" is usually the male; the female answers "kee-wick", and together they make the famous "twit-twoo". Soft, comb-edged feathers let owls fly almost silently.',
    hint: 'Listen for an owl in the trees.', on: 'owl' });
  C.on('owl', () => { owls++; if (owls >= 2) C.learn('sound-carries'); });
  L({ id: 'sound-carries', topic: 'Night life', title: 'Why sounds carry at night',
    body: 'After sunset the ground cools the air touching it, and warmer air above bends sound back down instead of letting it escape upward. That is why a far-off owl or road sounds so close at night.',
    hint: 'Hear the owl more than once.' });
  L({ id: 'dawn-chorus', topic: 'Night life', title: 'The dawn chorus',
    body: 'Birds sing most at first light. Two likely reasons: the still, cool air carries song well, and it is still too dark to find food easily, so singing is a good use of the time.',
    hint: 'Stay up until first light.', check: () => C.state.minutes > 485 });

  // --- Night air ---
  L({ id: 'breath', topic: 'Night air', title: 'Seeing your breath',
    body: 'Your breath is warm and full of water vapour. When it meets cold air, the vapour condenses into tiny droplets, a little cloud. It usually shows below about 7 °C, and a little sooner in damp air, like here by the lake.',
    hint: 'Stay up past midnight.', check: () => C.state.minutes > 200 });
  L({ id: 'mist', topic: 'Night air', title: 'Mist on the water',
    body: 'On a clear, still night the land and air cool fast, while the lake stays warmer. Vapour rising off the water meets the cold air and condenses, just like your breath, into a low mist.',
    hint: 'Watch the lake in the small hours.', check: () => C.state.minutes > 275 });
  L({ id: 'coldest', topic: 'Night air', title: 'Clear nights are cold',
    body: 'With no clouds as a blanket, the ground radiates its warmth straight out to space. The coldest moment of the night usually comes around sunrise, not at midnight.',
    hint: 'Stay up into the last hours before dawn.', check: () => C.state.minutes > 380 });
})();
