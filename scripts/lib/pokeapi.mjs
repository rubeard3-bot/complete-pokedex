import path from 'node:path';
import { cachedFetchJson, pool, downloadFile } from './http.mjs';

const API = 'https://pokeapi.co/api/v2';

export function idFromUrl(url) {
  const m = String(url).match(/\/(\d+)\/?$/);
  return m ? Number(m[1]) : null;
}

export async function fetchPokemonCore(ids, cacheDir, { force = false } = {}) {
  const pokemon = new Map();
  const species = new Map();
  const { errors } = await pool(
    ids,
    8,
    async (id) => {
      const [p, s] = await Promise.all([
        cachedFetchJson(`${API}/pokemon/${id}`, path.join(cacheDir, 'pokeapi', 'pokemon', `${id}.json`), { force }),
        cachedFetchJson(`${API}/pokemon-species/${id}`, path.join(cacheDir, 'pokeapi', 'species', `${id}.json`), { force }),
      ]);
      if (p.__notFound || s.__notFound) throw new Error(`PokeAPI 404 for id ${id}`);
      pokemon.set(id, p);
      species.set(id, s);
    },
    'pokeapi core'
  );
  return { pokemon, species, errors };
}

export async function fetchEvolutionChains(speciesMap, cacheDir, { force = false } = {}) {
  const chainUrls = new Map();
  for (const s of speciesMap.values()) {
    if (s.evolution_chain?.url) chainUrls.set(idFromUrl(s.evolution_chain.url), s.evolution_chain.url);
  }
  const entries = [...chainUrls.entries()];
  const chains = new Map();
  const { errors } = await pool(
    entries,
    8,
    async ([chainId, url]) => {
      const chain = await cachedFetchJson(url, path.join(cacheDir, 'pokeapi', 'evolution-chain', `${chainId}.json`), { force });
      if (!chain.__notFound) chains.set(chainId, chain);
    },
    'evolution chains'
  );
  return { chains, errors };
}

// Mega evolutions are separate "pokemon" variety records hanging off a
// species (charizard -> charizard-mega-x / charizard-mega-y). Fetch the
// variety record for every species that has one; gmax/regional forms are
// deliberately not matched.
export async function fetchMegaForms(speciesMap, cacheDir, { force = false } = {}) {
  const wanted = [];
  for (const [speciesId, s] of speciesMap) {
    for (const v of s.varieties ?? []) {
      const slug = v.pokemon?.name ?? '';
      if (/-mega(-|$)/.test(slug)) wanted.push({ speciesId, formId: idFromUrl(v.pokemon.url), slug });
    }
  }
  const records = new Map();
  const { errors } = await pool(
    wanted,
    8,
    async ({ formId }) => {
      const p = await cachedFetchJson(`${API}/pokemon/${formId}`, path.join(cacheDir, 'pokeapi', 'pokemon', `${formId}.json`), { force });
      if (p.__notFound) throw new Error(`PokeAPI 404 for mega form ${formId}`);
      records.set(formId, p);
    },
    'mega forms'
  );
  const megasBySpecies = new Map();
  for (const { speciesId, formId, slug } of wanted) {
    const p = records.get(formId);
    if (!p) continue;
    if (!megasBySpecies.has(speciesId)) megasBySpecies.set(speciesId, []);
    megasBySpecies.get(speciesId).push({
      id: formId,
      slug,
      types: (p.types ?? []).sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
      artworkUrl: p.sprites?.other?.['official-artwork']?.front_default ?? null,
      spriteUrl: p.sprites?.front_default ?? null,
    });
  }
  return { megasBySpecies, errors };
}

// "charizard-mega-x" + "Charizard" -> "Mega Charizard X";
// "magearna-original-mega" -> "Mega Magearna Original". Single-letter
// variant tokens (X/Y/Z) are uppercased, words are capitalized.
export function megaDisplayName(formSlug, speciesSlug, speciesEnglishName) {
  const suffix = formSlug.startsWith(`${speciesSlug}-`) ? formSlug.slice(speciesSlug.length + 1) : formSlug;
  const variant = suffix
    .split('-')
    .filter((t) => t !== 'mega')
    .map((t) => (t.length === 1 ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1)))
    .join(' ');
  return `Mega ${speciesEnglishName}${variant ? ` ${variant}` : ''}`;
}

// Full evolution line per species, grouped by stage, so every member's page
// can show the whole family row (handles branches: Eevee's stage 2 lists all
// eight evolutions side by side).
export function buildFamilies(chains) {
  const families = new Map();
  for (const chain of chains.values()) {
    if (!chain?.chain) continue;
    const stages = [];
    const members = [];
    (function walk(node, depth) {
      const id = idFromUrl(node.species.url);
      (stages[depth] ??= []).push(id);
      members.push(id);
      for (const child of node.evolves_to ?? []) walk(child, depth + 1);
    })(chain.chain, 0);
    for (const id of members) families.set(id, stages);
  }
  return families;
}

// Flatten every chain's nested tree into speciesId -> { fromId, toIds }
// (handles branching evolutions like Eevee's eight targets).
export function flattenEvolutions(chains) {
  const evo = new Map();
  function entry(id) {
    if (!evo.has(id)) evo.set(id, { fromId: null, toIds: [] });
    return evo.get(id);
  }
  function walk(node, parentId) {
    const id = idFromUrl(node.species.url);
    const e = entry(id);
    if (parentId != null) e.fromId = parentId;
    for (const child of node.evolves_to ?? []) {
      const childId = idFromUrl(child.species.url);
      if (!e.toIds.includes(childId)) e.toIds.push(childId);
      walk(child, id);
    }
  }
  for (const chain of chains.values()) {
    if (chain?.chain) walk(chain.chain, null);
  }
  return evo;
}

// Proper localized display name ("Nidoran♀", "Mr. Mime", "Flabébé") — never
// reconstructed from the slug.
export function englishName(speciesRecord) {
  return (
    speciesRecord.names?.find((n) => n.language?.name === 'en')?.name ??
    speciesRecord.name.charAt(0).toUpperCase() + speciesRecord.name.slice(1)
  );
}

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };

export function generationNumber(speciesRecord) {
  const roman = speciesRecord.generation?.name?.replace('generation-', '') ?? '';
  return ROMAN[roman] ?? null;
}

export async function downloadSprites(pokemonMap, outDir) {
  const items = [...pokemonMap.entries()];
  return pool(
    items,
    8,
    async ([id, p]) => {
      const url = p.sprites?.front_default;
      if (url) await downloadFile(url, path.join(outDir, `${id}.png`));
    },
    'sprites'
  );
}
