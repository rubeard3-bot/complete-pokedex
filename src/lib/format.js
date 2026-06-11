export function padId(id) {
  return `#${String(id).padStart(4, '0')}`;
}

export function formatPrice(price, currency) {
  if (price == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency ?? 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export function titleCase(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export const ALL_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
  'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark',
  'steel', 'fairy',
];

export const GENERATIONS = [
  { gen: 1, region: 'Kanto' },
  { gen: 2, region: 'Johto' },
  { gen: 3, region: 'Hoenn' },
  { gen: 4, region: 'Sinnoh' },
  { gen: 5, region: 'Unova' },
  { gen: 6, region: 'Kalos' },
  { gen: 7, region: 'Alola' },
  { gen: 8, region: 'Galar' },
  { gen: 9, region: 'Paldea' },
];
