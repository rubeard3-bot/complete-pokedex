import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { englishName, generationNumber, megaDisplayName } from './pokeapi.mjs';
import { REGIONS, HISUI_SPECIES_IDS, GENERATION_COUNTS } from '../data/regions.mjs';
import { FAN_FAVORITES } from '../data/fan-favorites.mjs';

function regionFor(id, generation) {
  if (HISUI_SPECIES_IDS.has(id)) return 'Hisui';
  return REGIONS[generation] ?? 'Unknown';
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function cleanFlavorText(text) {
  return text
    .replace(/[\n\f]/g, ' ')
    .replace(/POKéMON/g, 'Pokémon')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatHeight(decimeters) {
  const meters = decimeters / 10;
  const totalInches = Math.round(meters * 39.3701);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${String(inches).padStart(2, '0')}" (${meters.toFixed(1)} m)`;
}

function formatWeight(hectograms) {
  const kg = hectograms / 10;
  const lbs = kg * 2.20462;
  return `${lbs.toFixed(1)} lbs (${kg.toFixed(1)} kg)`;
}

// Kids-Pokédex-book style profile: who they are, where they're from, how big
// they are, and a couple of official entries about what they do.
export function buildDescription(p, s, { name, types, region }) {
  const genus = s.genera?.find((g) => g.language?.name === 'en')?.genus ?? 'a Pokémon';
  const typePhrase =
    types.length > 1
      ? `${types.slice(0, -1).map(capitalize).join('-, ')}- and ${capitalize(types[types.length - 1])}-type`
      : `${capitalize(types[0] ?? 'mystery')}-type`;
  const regionPhrase = region && region !== 'Unknown' ? ` first discovered in the ${region} region` : '';

  const sentences = [`${name} is the ${genus}, ${/^[aeiou]/i.test(typePhrase) ? 'an' : 'a'} ${typePhrase}${regionPhrase}.`];

  if (s.is_mythical) sentences.push('It is an extremely rare Mythical Pokémon!');
  else if (s.is_legendary) sentences.push('It is an extremely rare Legendary Pokémon!');

  if (p.height != null && p.weight != null) {
    sentences.push(`It stands ${formatHeight(p.height)} tall and weighs ${formatWeight(p.weight)}.`);
  }

  // Two distinct behavior entries, newest game versions first, skipping the
  // entry already shown separately as flavorText.
  const primaryFlavor = s.flavor_text_entries?.find((f) => f.language?.name === 'en')?.flavor_text;
  const primaryClean = primaryFlavor ? cleanFlavorText(primaryFlavor) : null;
  const seen = new Set(primaryClean ? [primaryClean.toLowerCase()] : []);
  const behavior = [];
  const english = (s.flavor_text_entries ?? []).filter((f) => f.language?.name === 'en');
  for (let i = english.length - 1; i >= 0 && behavior.length < 2; i--) {
    const text = cleanFlavorText(english[i].flavor_text ?? '');
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    behavior.push(text);
  }
  // Tiny dex (single entry): fall back to the primary entry rather than none.
  if (!behavior.length && primaryClean) behavior.push(primaryClean);

  return sentences.concat(behavior).join(' ');
}

// Resolve curated fan-favorite names to species ids. Hard-fails on a full run
// so a typo in the curated list can't ship silently.
export function resolveFanFavorites(speciesById, { fullRun }) {
  const byName = new Map();
  for (const [id, s] of speciesById) byName.set(englishName(s).toLowerCase(), id);
  const rankById = new Map();
  const unmatched = [];
  for (const fav of FAN_FAVORITES) {
    const id = byName.get(fav.name.toLowerCase());
    if (id != null) rankById.set(id, fav.rank);
    else unmatched.push(fav.name);
  }
  if (unmatched.length) {
    const msg = `fan favorites not found in species list: ${unmatched.join(', ')}`;
    if (fullRun) throw new Error(msg);
    console.warn(`(subset run) ${msg}`);
  }
  return rankById;
}

export async function writeOutputs({ ids, pokemonById, speciesById, evolutions, families, megasBySpecies, cardsBySpecies, exclusionLog, outDir }) {
  const fullRun = ids.length >= 1025;
  const favoriteRanks = resolveFanFavorites(speciesById, { fullRun });
  const dataDir = path.join(outDir, 'data');
  const detailDir = path.join(dataDir, 'pokemon');
  await mkdir(detailDir, { recursive: true });

  const nameOf = (id) => (speciesById.has(id) ? englishName(speciesById.get(id)) : `#${id}`);
  const now = new Date().toISOString();
  const index = [];
  const genCounts = {};
  const lowCardSpecies = [];

  for (const id of ids) {
    const p = pokemonById.get(id);
    const s = speciesById.get(id);
    if (!p || !s) continue;
    const name = englishName(s);
    const generation = generationNumber(s);
    const region = regionFor(id, generation);
    const types = (p.types ?? []).sort((a, b) => a.slot - b.slot).map((t) => t.type.name);
    const evo = evolutions.get(id) ?? { fromId: null, toIds: [] };
    const cards = cardsBySpecies.get(id) ?? [];

    // Full family row: every evolution stage plus the family's mega
    // evolutions, so e.g. Charmander's page shows Charmander → Charmeleon →
    // Charizard → Mega Charizard X / Y.
    const familyStages = families.get(id) ?? [[id]];
    const familyMegas = [];
    for (const stage of familyStages) {
      for (const memberId of stage) {
        for (const m of megasBySpecies.get(memberId) ?? []) {
          familyMegas.push({
            id: m.id,
            name: megaDisplayName(m.slug, speciesById.get(memberId)?.name ?? '', nameOf(memberId)),
            ofId: memberId,
            types: m.types,
            sprite: `sprites/${m.id}.png`,
            artworkUrl: m.artworkUrl,
          });
        }
      }
    }
    const favoriteRank = favoriteRanks.get(id) ?? null;

    genCounts[generation] = (genCounts[generation] ?? 0) + 1;
    if (cards.length < 3) lowCardSpecies.push({ id, name, cards: cards.length });

    index.push({
      id,
      name,
      slug: s.name,
      types,
      generation,
      region,
      favoriteRank,
      sprite: `sprites/${id}.png`,
    });

    const detail = {
      id,
      name,
      slug: s.name,
      types,
      generation,
      region,
      favoriteRank,
      artworkUrl: p.sprites?.other?.['official-artwork']?.front_default ?? null,
      flavorText:
        s.flavor_text_entries?.find((f) => f.language?.name === 'en')?.flavor_text?.replace(/[\n\f]/g, ' ') ?? null,
      description: buildDescription(p, s, { name, types, region }),
      evolution: {
        from: evo.fromId != null ? { id: evo.fromId, name: nameOf(evo.fromId) } : null,
        to: evo.toIds.map((tid) => ({ id: tid, name: nameOf(tid) })),
      },
      family: {
        stages: familyStages.map((stage) => stage.map((sid) => ({ id: sid, name: nameOf(sid) }))),
        megas: familyMegas,
      },
      cards,
      pricesUpdatedAt: now,
    };
    await writeFile(path.join(detailDir, `${id}.json`), JSON.stringify(detail));
  }

  await writeFile(path.join(dataDir, 'pokedex-index.json'), JSON.stringify(index));

  // Validate generation totals on full runs.
  const genMismatches = [];
  if (fullRun) {
    for (const [gen, want] of Object.entries(GENERATION_COUNTS)) {
      const got = genCounts[gen] ?? 0;
      if (got !== want) genMismatches.push({ generation: Number(gen), expected: want, actual: got });
    }
  }

  // Exclusion log: most frequent non-whitelisted tokens for manual review.
  const tokenCounts = new Map();
  for (const ex of exclusionLog) {
    for (const t of ex.badTokens) {
      const e = tokenCounts.get(t) ?? { count: 0, samples: [] };
      e.count++;
      if (e.samples.length < 3 && !e.samples.includes(ex.cardName)) e.samples.push(ex.cardName);
      tokenCounts.set(t, e);
    }
  }
  const topExcludedTokens = [...tokenCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 40)
    .map(([token, e]) => ({ token, count: e.count, samples: e.samples }));

  const report = {
    generatedAt: now,
    pokemonWritten: index.length,
    megaFormCount: [...megasBySpecies.values()].flat().length,
    generationCounts: genCounts,
    generationMismatches: genMismatches,
    fanFavoritesResolved: favoriteRanks.size,
    excludedCardCount: exclusionLog.length,
    topExcludedTokens,
    speciesWithFewCards: lowCardSpecies,
  };
  await writeFile(path.join('scripts', 'last-run-report.json'), JSON.stringify(report, null, 2));
  return report;
}
