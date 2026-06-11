# Complete Pokédex

A locally-hosted "one stop shop" for the entire Pokémon world: all **1025 Pokémon** (Gen 1 Kanto → Gen 9 Paldea) with types, regions, evolution chains, fan-favorite rankings, and each Pokémon's **top 10 most valuable trading cards** with real market prices.

## Run it

```powershell
npm install
npm run dev          # open http://localhost:5173
```

Production build:

```powershell
npm run build
npm run preview      # serves the optimized build
```

All Pokédex + card data ships pre-built in `public/data/`, so the app works immediately — no API keys, no accounts.

## What you can do

- **Browse** the full grid of 1025 Pokémon, with search (name or number), region/generation filter, type filter, and a ⭐ fan-favorites filter.
- **Click any Pokémon** to see:
  - Official artwork, types, Pokédex flavor text
  - **Family/region** (Kanto, Johto, … Paldea, incl. Hisui for Legends: Arceus species)
  - **Full family row** — every stage of the evolution line side by side (handles branches like Eevee's 8 evolutions), with the family's **Mega Evolutions** at the end (Charmander → Charmeleon → Charizard ⇢ Mega Charizard X / Mega Charizard Y). Mega chips link back to their base species; EX/GX/V card variants appear in the cards list below.
  - **Fan favorite** status — rank from the 2020 Google "Pokémon of the Year" poll (top 30)
  - **Top 10 most valuable cards** — card image (click for full size), the set/pack it comes from, rarity, print variant, and market price. Prices are TCGPlayer market (USD), falling back to Cardmarket (EUR).

## Refreshing the data

Card prices are a snapshot. To refresh:

```powershell
npm run update-data -- --refresh-prices   # re-fetch card prices only
npm run update-data                       # full refresh (uses local cache, fast re-runs)
```

Useful flags:

| Flag | Effect |
|---|---|
| `--ids 1-151` | only process a range/list of Pokémon (dev loop) |
| `--refresh-prices` | force re-fetch of card details/prices |
| `--skip-cards` | Pokédex data only, no TCG fetches |
| `--force` | ignore all caches |

The pipeline is **resumable**: every API response is cached in `.cache/`, so if it's interrupted, just re-run it and it picks up where it left off. After each run, check `scripts/last-run-report.json` for data-quality stats (counts per generation, cards excluded by the name filter, Pokémon with few cards).

`node scripts/test-matching.mjs` runs the card-name matching self-tests (Mew vs. Mewtwo, Nidoran♀/♂, Porygon family, tag teams, etc.).

## Data sources

- [PokéAPI](https://pokeapi.co) — Pokémon species, types, evolutions, artwork, sprites
- [TCGdex](https://tcgdex.dev) — TCG card catalog, sets, images, and market prices (TCGPlayer / Cardmarket)
- 2020 Google "Pokémon of the Year" poll — fan-favorite ranks (embedded in `scripts/data/fan-favorites.mjs`)

**Offline note:** grid sprites are stored locally, so browsing works offline. The big detail-page artwork and card images are hotlinked (downloading ~20k card scans locally would be gigabytes), so those need an internet connection.

## How card matching works

TCG card names are matched to species with a whole-token matcher (`scripts/lib/name-matching.mjs`): "Mewtwo EX" never lands on Mew's page, "Nidoran♀" cards stay separate from "Nidoran♂", tag-team cards ("Pikachu & Zekrom-GX") count for both partners, and trainer items ("Charizard Spirit Link") are excluded. Unknown name patterns are dropped conservatively and logged in `scripts/last-run-report.json` for whitelist tuning.

*Unofficial fan project. Pokémon is © Nintendo / Creatures Inc. / GAME FREAK.*
