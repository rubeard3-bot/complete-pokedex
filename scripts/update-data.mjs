// Pokédex data pipeline. Downloads PokéAPI species/evolution data and TCGdex
// card prices into static JSON under public/data (+ sprites under public/sprites).
//
// Usage:
//   node scripts/update-data.mjs                  # full 1..1025 run
//   node scripts/update-data.mjs --ids 1-151      # subset (dev loop)
//   node scripts/update-data.mjs --ids 6,25,150   # explicit ids
//   node scripts/update-data.mjs --refresh-prices # force re-fetch card details
//   node scripts/update-data.mjs --skip-cards     # Pokédex data only, no TCG
//   node scripts/update-data.mjs --force          # ignore all caches
import path from 'node:path';
import { fetchPokemonCore, fetchEvolutionChains, flattenEvolutions, fetchMegaForms, buildFamilies, downloadSprites, englishName } from './lib/pokeapi.mjs';
import { downloadFile, pool } from './lib/http.mjs';
import { fetchAllCardBriefs, fetchCardDetails, buildCardRecord, topCards } from './lib/tcgdex.mjs';
import { buildSpeciesIndex, matchCardName } from './lib/name-matching.mjs';
import { writeOutputs } from './lib/transform.mjs';

const MAX_ID = 1025;
const CACHE_DIR = '.cache';
const OUT_DIR = 'public';

function parseArgs(argv) {
  const args = { ids: null, force: false, refreshPrices: false, skipCards: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') args.force = true;
    else if (a === '--refresh-prices') args.refreshPrices = true;
    else if (a === '--skip-cards') args.skipCards = true;
    else if (a === '--ids') {
      const spec = argv[++i];
      const ids = new Set();
      for (const part of String(spec).split(',')) {
        const m = part.match(/^(\d+)-(\d+)$/);
        if (m) for (let n = Number(m[1]); n <= Number(m[2]); n++) ids.add(n);
        else if (/^\d+$/.test(part)) ids.add(Number(part));
        else throw new Error(`bad --ids part: ${part}`);
      }
      args.ids = [...ids].filter((n) => n >= 1 && n <= MAX_ID).sort((a, b) => a - b);
    } else throw new Error(`unknown arg: ${a}`);
  }
  if (!args.ids) args.ids = Array.from({ length: MAX_ID }, (_, i) => i + 1);
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const t0 = Date.now();
  console.log(`Pokédex pipeline: ${args.ids.length} Pokémon (${args.ids[0]}..${args.ids[args.ids.length - 1]})` +
    `${args.skipCards ? ' [skip cards]' : ''}${args.refreshPrices ? ' [refresh prices]' : ''}${args.force ? ' [force]' : ''}`);

  // Phase 1: PokéAPI core
  const { pokemon: pokemonById, species: speciesById, errors: coreErrors } = await fetchPokemonCore(args.ids, CACHE_DIR, { force: args.force });
  if (coreErrors.length) throw new Error(`${coreErrors.length} PokéAPI core fetches failed — re-run to resume.`);

  // Phase 2: evolution chains
  const { chains, errors: chainErrors } = await fetchEvolutionChains(speciesById, CACHE_DIR, { force: args.force });
  if (chainErrors.length) throw new Error(`${chainErrors.length} evolution chain fetches failed — re-run to resume.`);
  const evolutions = flattenEvolutions(chains);
  const families = buildFamilies(chains);

  // Phase 2b: mega evolution forms (separate variety records, e.g. Mega Charizard X/Y)
  const { megasBySpecies, errors: megaErrors } = await fetchMegaForms(speciesById, CACHE_DIR, { force: args.force });
  if (megaErrors.length) throw new Error(`${megaErrors.length} mega form fetches failed — re-run to resume.`);

  // Phase 3: sprite thumbnails (base forms + megas)
  await downloadSprites(pokemonById, path.join(OUT_DIR, 'sprites'));
  const megaList = [...megasBySpecies.values()].flat();
  await pool(
    megaList,
    8,
    async (m) => {
      // Brand-new megas (Legends: Z-A) often have official artwork before a
      // game sprite exists — use artwork as the thumbnail in that case.
      const url = m.spriteUrl ?? m.artworkUrl;
      if (url) await downloadFile(url, path.join(OUT_DIR, 'sprites', `${m.id}.png`));
    },
    'mega sprites'
  );

  // Phases 4-6: TCG cards
  const cardsBySpecies = new Map();
  const exclusionLog = [];
  if (!args.skipCards) {
    const briefs = await fetchAllCardBriefs(CACHE_DIR, { force: args.force });
    console.log(`TCGdex catalog: ${briefs.length} English cards`);

    const speciesList = args.ids.map((id) => ({ id, name: englishName(speciesById.get(id)) }));
    const speciesIndex = buildSpeciesIndex(speciesList);

    const cardIdToSpecies = new Map();
    for (const brief of briefs) {
      if (!brief?.name || !brief?.id) continue;
      const result = matchCardName(brief.name, speciesIndex);
      if (result.excluded) exclusionLog.push({ cardName: brief.name, cardId: brief.id, badTokens: result.badTokens });
      else if (result.speciesIds.length) cardIdToSpecies.set(brief.id, result.speciesIds);
    }
    console.log(`Matched ${cardIdToSpecies.size} cards to species (${exclusionLog.length} excluded by name filter)`);

    const { details, errors: detailErrors } = await fetchCardDetails([...cardIdToSpecies.keys()], CACHE_DIR, {
      refreshPrices: args.refreshPrices,
      force: args.force,
    });
    if (detailErrors.length > cardIdToSpecies.size * 0.02) {
      throw new Error(`${detailErrors.length} card detail fetches failed (>2%) — re-run to resume.`);
    }

    const recordsBySpecies = new Map();
    for (const [cardId, speciesIds] of cardIdToSpecies) {
      const detail = details.get(cardId);
      if (!detail) continue;
      const record = buildCardRecord(detail);
      for (const sid of speciesIds) {
        if (!recordsBySpecies.has(sid)) recordsBySpecies.set(sid, []);
        recordsBySpecies.get(sid).push(record);
      }
    }
    for (const [sid, records] of recordsBySpecies) {
      cardsBySpecies.set(sid, topCards(records, 10).map((r, i) => ({ rank: i + 1, ...r })));
    }
  }

  // Phase 7: write outputs + report
  const report = await writeOutputs({
    ids: args.ids,
    pokemonById,
    speciesById,
    evolutions,
    families,
    megasBySpecies,
    cardsBySpecies,
    exclusionLog,
    outDir: OUT_DIR,
  });

  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\nDone in ${mins} min.`);
  console.log(`  Pokémon written:        ${report.pokemonWritten}`);
  console.log(`  Mega forms included:    ${report.megaFormCount}`);
  console.log(`  Generation counts:      ${JSON.stringify(report.generationCounts)}`);
  if (report.generationMismatches.length) {
    console.error(`  GENERATION MISMATCHES:  ${JSON.stringify(report.generationMismatches)}`);
  }
  console.log(`  Fan favorites resolved: ${report.fanFavoritesResolved}/30`);
  console.log(`  Cards excluded by name filter: ${report.excludedCardCount} (see scripts/last-run-report.json)`);
  console.log(`  Species with <3 cards:  ${report.speciesWithFewCards.length}`);
}

main().catch((err) => {
  console.error(`\nPipeline failed: ${err.message}`);
  process.exit(1);
});
