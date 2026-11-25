// © 2026 George Moussa. All rights reserved.
// CAMP 14. LESSONS: the sky. Field guide pages for the real night sky of 20E, unlocked by the star finder
//     (62_star_finder.js emits 'sky' with a constellation id once you have held your gaze on it) and by the night
//     itself (the sky turning, a shooting star, your headlamp). `sky` on a page draws that constellation while the
//     page is up, and the guide shows where it is right now for pages still locked.
//     Every line was checked before it landed: README "Facts checked". Keep pages short: three sentences at most.
(function () {
  if (!window.Camp || !Camp.lesson) return;
  const C = Camp, L = C.lesson, T = 'Sky';
  const found = (id) => !!(C.sky && C.sky.found(id));
  const sky = (id, title, body, hint, extra) => L(Object.assign({ id, topic: T, title, body, hint, sky: id, on: 'sky', when: (d) => d.id === id }, extra || {}));
  let firstSky = true;
  C.on('night', () => { firstSky = true; });

  // --- how the sky works ---
  L({ id: 'light-time', topic: T, title: 'Starlight is old',
    body: 'Light covers about 9.5 trillion kilometres in a year: one light year. The stars you can see are a few to thousands of light years away, so you see each one as it was when that light set out.',
    hint: 'Look up and hold your gaze on any constellation.' });
  sky('dipper', 'The Big Dipper',
    'The Big Dipper is not a constellation on its own: it is the brightest part of Ursa Major, the Great Bear. The middle star of the handle, Mizar, has a faint partner, Alcor, that sharp eyes can split.',
    'Seven bright stars shaped like a ladle, in the north.', { tryIt: 'find Alcor beside Mizar in the handle.' });
  sky('polaris', 'Polaris, the North Star',
    'Follow the two stars at the end of the Dipper\'s bowl about five times their gap and you reach Polaris. It sits less than a degree from the point the whole sky turns around, so it barely moves all night. It is not especially bright: about the 48th brightest star.',
    'Follow the two end stars of the Big Dipper\'s bowl.');
  L({ id: 'latitude', topic: T, sky: 'polaris', title: 'Polaris tells you where you are',
    body: 'Polaris stands as high above the horizon as you are north of the equator. Here it is 45° up, so this camp is at 45° north. A fist at arm\'s length covers about 10°, so that is four and a half fists.',
    tryIt: 'stack fists from the horizon up to Polaris.', hint: 'Find Polaris.' });
  L({ id: 'sky-turns', topic: T, sky: 'dipper', title: 'The sky turns',
    body: 'The stars have moved since you found Polaris. Earth spins once a day, so the whole sky wheels around Polaris about 15° every hour, anticlockwise as you face north. Polaris alone stays put.',
    hint: 'Find Polaris, then come back to the Dipper an hour or two later.', check: () => found('polaris') && C.state.minutes - C.sky.foundAt('polaris') > 100 });
  L({ id: 'sidereal', topic: T, title: 'Four minutes earlier every night',
    body: 'A day by the stars is 23 hours 56 minutes, so each star rises about 4 minutes earlier every night. Over a year that adds up to a whole day: that is why the evening sky changes with the seasons.',
    hint: 'Watch the stars deep into the night.', check: () => C.state.minutes > 330 && C.sky && C.sky.ids.some(found) });
  L({ id: 'circumpolar', topic: T, sky: 'cassiopeia', title: 'Stars that never set',
    body: 'From 45° north, every star within 45° of Polaris never sets: the Dippers and Cassiopeia just circle the pole all year. Stars farther south rise and set like the Sun.',
    hint: 'Find both the Big Dipper and Cassiopeia.', check: () => found('dipper') && found('cassiopeia') });
  L({ id: 'twinkle', topic: T, title: 'Why stars twinkle',
    body: 'Air is never still: pockets of warm and cool air bend starlight on its way down, so stars twinkle, and the low ones most, because their light crosses more air. Planets usually twinkle less, since they show a tiny disc instead of a point.',
    hint: 'Look at a constellation low over the trees.' });
  L({ id: 'star-colour', topic: T, title: 'A star\'s colour is its temperature',
    body: 'Orange and red stars like Arcturus, Aldebaran and Betelgeuse are the cool ones, around 3,000 to 4,500 °C at the surface. Blue-white stars like Rigel are much hotter, above 10,000 °C.',
    hint: 'Find an orange star: Arcturus early, Aldebaran or Betelgeuse late.' });
  L({ id: 'meteor', topic: T, title: 'Shooting stars',
    body: 'A shooting star is a speck of space dust, often smaller than a grain of sand, hitting the air at more than 11 km a second. It burns up about 75 to 120 km above the ground.',
    tryIt: 'hold your gaze on the sky and wait.', hint: 'Watch the sky until a shooting star crosses it.', on: 'meteor' });
  L({ id: 'dark-eyes', topic: T, title: 'Night eyes',
    body: 'Your eyes take 20 to 30 minutes to get fully used to the dark, and one look at a bright white light sets them back. Stargazers use red lights: the rods that give you night vision barely respond to red.',
    hint: 'Switch on your headlamp under the stars.', on: 'lamp', when: (d) => d.on && C.starsOut(C.state.minutes) > 0.5 });
  L({ id: 'constellations', topic: T, title: '88 constellations',
    body: 'Astronomers agreed on 88 official constellations in the 1920s, with borders that cover the whole sky like countries on a map. The lines are just a way to remember the patterns; the stars in one are often nowhere near each other.',
    hint: 'Open the star chart (K).', on: 'chart', when: (d) => d.on });

  // --- around the pole ---
  sky('littledipper', 'The Little Dipper',
    'Polaris is the tip of the Little Dipper\'s handle. Most of its stars are faint, so it is a good test of a dark sky: city lights often hide all but Polaris and the two stars at the end of its bowl.',
    'Polaris is the end of its handle.');
  sky('cassiopeia', 'Cassiopeia',
    'The W of Cassiopeia, the Queen, sits on the far side of Polaris from the Big Dipper. When one is low the other is high, so between them you can always find north.',
    'A W of five stars, across Polaris from the Dipper.');
  sky('thuban', 'Thuban, the old pole star',
    'Around the time the pyramids of Egypt were built, the pole star was Thuban, not Polaris. Earth\'s axis wobbles like a slowing top, one circle every 26,000 years, so the pole drifts from star to star.',
    'A faint star between the Big Dipper\'s bowl and the Little Dipper\'s.');
  sky('draco', 'The Dragon\'s head',
    'Draco winds between the two Dippers, and its head is a lopsided box of stars. In the 1720s James Bradley watched Eltanin, the brightest, and its tiny yearly shift proved that Earth moves through space.',
    'Look high, between Vega and the Little Dipper.');

  // --- the evening stars ---
  sky('bootes', 'Arc to Arcturus',
    'Follow the curve of the Dipper\'s handle away from the bowl and you "arc to Arcturus", the brightest star in the northern half of the sky. It is an orange giant about 37 light years away.',
    'Follow the curve of the Big Dipper\'s handle (it sets early in the night).');
  sky('lyra', 'Vega and the Lyre',
    'Vega, about 25 light years away, is one of the brightest stars in the sky. Because of Earth\'s slow wobble, Vega was the pole star about 14,000 years ago, and will be again around the year 13,700.',
    'The bright blue-white star very high overhead in the evening.');
  sky('cygnus', 'The Swan',
    'Cygnus flies along the Milky Way; its brightest stars also make the Northern Cross. Its tail, Deneb, is a supergiant so far away that astronomers still argue about the distance: somewhere around 1,500 to 2,600 light years.',
    'A big cross high overhead, Deneb at its top.', { tryIt: 'find Albireo at the swan\'s beak: a telescope shows it as a gold star and a blue one.' });
  sky('aquila', 'The Eagle',
    'Altair, about 17 light years away, spins once in under ten hours, so fast it bulges at its middle. The Sun takes about 25 days to turn once.',
    'A bright star with a fainter star on each side, in the south in the evening.');
  sky('triangle', 'The Summer Triangle',
    'Vega, Deneb and Altair make the Summer Triangle. Deneb looks the faintest of the three, but it is really the most powerful: it is somewhere between 60 and 100 times farther away than Vega.',
    'Find Lyra, Cygnus and Aquila.');
  sky('fomalhaut', 'The lonely star',
    'Fomalhaut sits low in the south in autumn with no other bright star near it. It is about 25 light years away and wrapped in a wide ring of dust that space telescopes have photographed.',
    'Low in the south, alone.');

  // --- the autumn stars ---
  sky('pegasus', 'The Great Square',
    'Four stars make a big square, the body of Pegasus, the winged horse. One corner, Alpheratz, really belongs to Andromeda: the two constellations share it.',
    'A large square of four stars in the east, then high in the south.');
  sky('andromeda', 'The Andromeda Galaxy',
    'From Mirach, two faint stars point to a small smudge: the Andromeda Galaxy, a spiral of up to a trillion stars. Its light set out about 2.5 million years ago, which makes it one of the farthest things you can see without a telescope.',
    'A chain of stars running from one corner of the Great Square.', { tryIt: 'look just beside the ringed smudge; it shows better that way.' });
  sky('perseus', 'Perseus and the Demon Star',
    'Algol, the "Demon Star", fades to about a third of its brightness every 2 days 21 hours, when a dimmer partner passes in front of it. Each August the Perseid meteors seem to fly out of this part of the sky.',
    'Below Cassiopeia, rising in the northeast.');
  sky('pleiades', 'The Seven Sisters',
    'Most people see six stars here, and sharp eyes under a dark sky see more. The Pleiades are a family of young stars about 440 light years away, born together roughly 100 million years ago. Faint things show better if you look just beside them: the edge of your eye sees better in the dark.',
    'A tiny misty cluster, low in the northeast in the evening and climbing.', { tryIt: 'count the sisters, then look slightly to one side.' });
  sky('auriga', 'Capella',
    'Capella is the sixth brightest star at night, and it is really four stars: two yellow giants in a tight pair and two small red dwarfs farther out. From 45° north it never quite sets.',
    'A bright yellowish star low in the northeast, climbing through the night.');

  // --- before dawn ---
  sky('taurus', 'The Bull\'s eye',
    'Aldebaran, the Bull\'s orange eye, sits in a V of stars called the Hyades, but only looks part of it: Aldebaran is about 65 light years away, the Hyades about 150.',
    'An orange star that rises in the east before midnight, below the Pleiades.');
  sky('orion', 'Orion',
    'This time of year Orion rises in the small hours; by winter he fills the evening sky. Red Betelgeuse and blue-white Rigel are both supergiants hundreds of light years away, and the fuzzy patch in his sword is the Orion Nebula, where new stars are forming about 1,300 light years away.',
    'Three stars in a row, rising in the east before dawn.');
  sky('gemini', 'The Twins',
    'The twins\' heads are Castor and Pollux. Pollux is a single orange giant, but Castor is a family of six stars: three pairs, all circling each other.',
    'Two bright stars side by side, low in the northeast before dawn.');
  sky('sirius', 'Sirius, the Dog Star',
    'Sirius is the brightest star in the night sky, only about 8.6 light years away. Low on the horizon it flashes colours, because its light crosses so much moving air.',
    'The brightest star of all, low in the southeast just before dawn.');

  // chained pages, after every page above has its own listener (so Polaris comes before what it teaches)
  C.on('sky', (d) => {
    if (firstSky) { firstSky = false; C.learn('light-time'); }
    if (d.alt < 25) C.learn('twinkle');
    if (d.id === 'bootes' || d.id === 'taurus' || d.id === 'orion') C.learn('star-colour');
    if (d.id === 'polaris') C.learn('latitude');
  });
})();
