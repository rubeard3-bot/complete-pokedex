// Quick self-test for name-matching logic. Run: node scripts/test-matching.mjs
import { tokenize, buildSpeciesIndex, matchCardName } from './lib/name-matching.mjs';

const species = [
  { id: 6, name: 'Charizard' },
  { id: 25, name: 'Pikachu' },
  { id: 29, name: 'Nidoran♀' },
  { id: 32, name: 'Nidoran♂' },
  { id: 83, name: "Farfetch'd" },
  { id: 122, name: 'Mr. Mime' },
  { id: 133, name: 'Eevee' },
  { id: 137, name: 'Porygon' },
  { id: 150, name: 'Mewtwo' },
  { id: 151, name: 'Mew' },
  { id: 233, name: 'Porygon2' },
  { id: 250, name: 'Ho-Oh' },
  { id: 439, name: 'Mime Jr.' },
  { id: 474, name: 'Porygon-Z' },
  { id: 644, name: 'Zekrom' },
  { id: 669, name: 'Flabébé' },
  { id: 772, name: 'Type: Null' },
  { id: 866, name: 'Mr. Rime' },
];
const index = buildSpeciesIndex(species);

const cases = [
  // [card name, expected species ids]
  ['Charizard', [6]],
  ['M Charizard-EX', [6]],
  ['Dark Charizard', [6]],
  ['Charizard VMAX', [6]],
  ['Mewtwo', [150]],
  ['Mew', [151]],
  ['Mewtwo EX', [150]],
  ['Shining Mew', [151]],
  ['Team Rocket’s Mewtwo ex', [150]],
  ['Nidoran ♀', [29]],
  ['Nidoran ♂', [32]],
  ['Mr. Mime', [122]],
  ['Mime Jr.', [439]],
  ['Mr. Rime', [866]],
  ["Farfetch'd", [83]],
  ["Galarian Farfetch'd", [83]],
  ['Type: Null', [772]],
  ['Flabébé', [669]],
  ['Ho-Oh LEGEND', [250]],
  ['Porygon', [137]],
  ['Porygon2', [233]],
  ['Porygon-Z', [474]],
  ['Porygon-Z GX', [474]],
  ['Pikachu & Zekrom-GX', [25, 644]],
  ['Surfing Pikachu', [25]],
  ['Pikachu VMAX', [25]],
  ['Eevee', [133]],
  ['Pikachu Libre', [25]],
  ['Pikachu with Grey Felt Hat', [25]], // Van Gogh promo
  ['Charizard Spirit Link', []], // trainer item, must stay excluded
  ['Eevee Bag', []], // trainer item, must stay excluded
  ['Detective Pikachu', [25]],
  ['Professor Oak', []], // no species in name at all
];

let failed = 0;
for (const [name, expected] of cases) {
  const result = matchCardName(name, index);
  const got = [...result.speciesIds].sort((a, b) => a - b);
  const want = [...expected].sort((a, b) => a - b);
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    failed++;
    console.error(`FAIL  "${name}"  expected [${want}] got [${got}]` + (result.badTokens ? ` badTokens=[${result.badTokens}]` : ''));
  } else {
    console.log(`ok    "${name}" -> [${got}]${result.excluded ? ' (excluded)' : ''}`);
  }
}

console.log('\nTokenizer spot checks:');
for (const n of ['Flabébé', 'Nidoran♀', "Farfetch'd", 'Type: Null', 'Ho-Oh', 'Charizard δ species']) {
  console.log(` ${n} ->`, tokenize(n).map((t) => t.text).join('|'));
}

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log('\nAll matching cases passed.');
