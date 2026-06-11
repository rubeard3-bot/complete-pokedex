import path from 'node:path';
import { cachedFetchJson, pool } from './http.mjs';

const API = 'https://api.tcgdex.net/v2/en';
const DAY = 24 * 3600 * 1000;

// One request returns every English card as a brief { id, localId, name, image? }.
export async function fetchAllCardBriefs(cacheDir, { force = false } = {}) {
  const briefs = await cachedFetchJson(`${API}/cards`, path.join(cacheDir, 'tcgdex', 'all-cards.json'), {
    maxAgeMs: 30 * DAY,
    force,
  });
  if (!Array.isArray(briefs)) throw new Error('TCGdex /cards did not return an array');
  return briefs;
}

export async function fetchCardDetails(cardIds, cacheDir, { refreshPrices = false, force = false } = {}) {
  const details = new Map();
  const { errors } = await pool(
    cardIds,
    4,
    async (cardId) => {
      const detail = await cachedFetchJson(
        `${API}/cards/${encodeURIComponent(cardId)}`,
        path.join(cacheDir, 'tcgdex', 'card', `${sanitizeId(cardId)}.json`),
        { maxAgeMs: refreshPrices ? 0 : 7 * DAY, force }
      );
      if (!detail.__notFound) details.set(cardId, detail);
    },
    'card details'
  );
  return { details, errors };
}

function sanitizeId(id) {
  return String(id).replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Best market price: max TCGPlayer marketPrice across variants (USD),
// falling back to Cardmarket trend/avg (EUR). Null when unpriced.
export function extractPrice(detail) {
  const tp = detail.pricing?.tcgplayer;
  if (tp && typeof tp === 'object') {
    let best = null;
    for (const [variant, data] of Object.entries(tp)) {
      if (!data || typeof data !== 'object') continue;
      const market = typeof data.marketPrice === 'number' ? data.marketPrice : typeof data.midPrice === 'number' ? data.midPrice : null;
      if (market != null && market > 0 && (best == null || market > best.price)) {
        best = { price: market, currency: 'USD', variant };
      }
    }
    if (best) return best;
  }
  const cm = detail.pricing?.cardmarket;
  if (cm && typeof cm === 'object') {
    // TCGdex maps some promos to wrong Cardmarket products with absurd values
    // (e.g. low €100,000 on a common promo). The Cardmarket path is only a
    // fallback for cards TCGPlayer doesn't price — overwhelmingly cheap promos —
    // so discard implausible data rather than rank junk at the top.
    const suspectLow = typeof cm.low === 'number' && cm.low > 5000;
    if (!suspectLow) {
      for (const key of ['trend-holo', 'trend', 'avg-holo', 'avg', 'avg7-holo', 'avg7']) {
        if (typeof cm[key] === 'number' && cm[key] > 0 && cm[key] <= 1000) {
          return { price: cm[key], currency: 'EUR', variant: 'cardmarket' };
        }
      }
    }
  }
  return null;
}

export function buildCardRecord(detail) {
  const priced = extractPrice(detail);
  return {
    cardId: detail.id,
    name: detail.name,
    set: detail.set?.name ?? null,
    rarity: detail.rarity ?? null,
    imageUrl: detail.image ? `${detail.image}/high.webp` : null,
    thumbUrl: detail.image ? `${detail.image}/low.webp` : null,
    price: priced?.price ?? null,
    currency: priced?.currency ?? null,
    variant: priced?.variant ?? null,
  };
}

// Priced cards first (descending), unpriced fill the remainder.
export function topCards(records, limit = 10) {
  const priced = records.filter((r) => r.price != null).sort((a, b) => b.price - a.price);
  const unpriced = records.filter((r) => r.price == null);
  return priced.concat(unpriced).slice(0, limit);
}
