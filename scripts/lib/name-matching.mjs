// Pure name-matching between Pokémon species names and TCG card names.
// TCGdex card names are matched locally against the full species list:
// a card belongs to a species when the species name appears in the card name
// as a contiguous whole-token sequence AND every leftover token is a known
// card-mechanic/variant word. Unknown leftovers exclude the card (logged for
// whitelist tuning) — conservative beats false positives.

const WHITELIST = new Set([
  // mechanic suffixes
  'ex', 'gx', 'v', 'vmax', 'vstar', 'break', 'star', 'prism', 'lv', 'x',
  'legend', 'prime', 'sp', 'fb', 'gl', 'c', 'g', 'e', 'union',
  // variant prefixes
  'm', 'mega', 'dark', 'light', 'shining', 'radiant', 'shiny', 'primal',
  'alolan', 'galarian', 'hisuian', 'paldean', 'white', 'black', 'team', 'lt',
  // forme words (cards put formes in the card name)
  'origin', 'altered', 'land', 'sky', 'forme', 'form', 'therian', 'incarnate',
  'delta', 'species',
  'mask', 'teal', 'hearthflame', 'wellspring', 'cornerstone', // Ogerpon
  'strike', 'rapid', 'single', // Urshifu
  'rider', 'ice', 'shadow', // Calyrex
  'cloak', 'plant', 'sandy', 'trash', // Burmy/Wormadam
  'sea', 'east', 'west', // Shellos/Gastrodon
  'bloodmoon', 'ultra', 'dawn', 'wings', 'dusk', 'mane', // Ursaluna/Necrozma
  'fan', 'heat', 'wash', 'mow', 'frost', // Rotom
  'sunny', 'rainy', 'rain', 'snowy', 'snow', 'cloud', // Castform
  'fossil', 'root', 'dome', 'claw', 'armor', 'old', 'amber', 'helix',
  'skull', 'cover', 'jaw', 'sail', // fossil Pokémon prints
  'normal', 'attack', 'defense', 'speed', // Deoxys formes
  'ash', // Ash-Greninja EX
  'bros', // Pichu Bros.
  // well-known special prints
  'surfing', 'flying', 'birthday', 'armored', 'detective',
  'libre', 'cool', 'special', 'delivery',
  'on', 'the', 'ball', 'with', 'grey', 'felt', 'hat', // "Pikachu on the Ball", Van Gogh "Pikachu with Grey Felt Hat"
]);

export function tokenize(name) {
  const text = String(name)
    .replace(/[’‘]/g, "'")
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics: Flabébé -> flabebe
    .toLowerCase()
    .replace(/♀/g, ' f ') // ♀
    .replace(/♂/g, ' m ') // ♂
    .replace(/δ/g, ' delta '); // δ
  return text
    .split(/[^a-z0-9']+/)
    .filter(Boolean)
    .map((raw) => ({ text: raw.replace(/'/g, ''), possessive: /'s$/.test(raw) }))
    .filter((t) => t.text.length > 0);
}

// speciesList: [{ id, name }] -> Map(firstToken -> [{ id, tokens }]),
// longest token sequences first so greedy matching prefers "Porygon-Z"
// over "Porygon" and "Mime Jr." over "Mr. Mime".
export function buildSpeciesIndex(speciesList) {
  const index = new Map();
  for (const s of speciesList) {
    const tokens = tokenize(s.name).map((t) => t.text);
    if (!tokens.length) continue;
    const entry = { id: s.id, tokens };
    const list = index.get(tokens[0]);
    if (list) list.push(entry);
    else index.set(tokens[0], [entry]);
  }
  for (const list of index.values()) list.sort((a, b) => b.tokens.length - a.tokens.length);
  return index;
}

// Returns { speciesIds, excluded, badTokens? }. A card can match multiple
// species (tag-team cards like "Pikachu & Zekrom-GX" belong to both).
export function matchCardName(cardName, speciesIndex) {
  const tokens = tokenize(cardName);
  const matchedIds = [];
  const leftovers = [];
  let i = 0;
  while (i < tokens.length) {
    const candidates = speciesIndex.get(tokens[i].text) ?? [];
    let matched = null;
    for (const cand of candidates) {
      if (
        cand.tokens.length <= tokens.length - i &&
        cand.tokens.every((t, k) => t === tokens[i + k].text)
      ) {
        matched = cand;
        break;
      }
    }
    if (matched) {
      if (!matchedIds.includes(matched.id)) matchedIds.push(matched.id);
      i += matched.tokens.length;
    } else {
      leftovers.push(tokens[i]);
      i++;
    }
  }
  if (!matchedIds.length) return { speciesIds: [], excluded: false };
  const badTokens = leftovers
    .filter((t) => !t.possessive && t.text.length > 1 && !WHITELIST.has(t.text))
    .map((t) => t.text);
  if (badTokens.length) return { speciesIds: [], excluded: true, badTokens };
  return { speciesIds: matchedIds, excluded: false };
}
