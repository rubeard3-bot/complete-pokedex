export const REGIONS = {
  1: 'Kanto',
  2: 'Johto',
  3: 'Hoenn',
  4: 'Sinnoh',
  5: 'Unova',
  6: 'Kalos',
  7: 'Alola',
  8: 'Galar',
  9: 'Paldea',
};

// Gen 8 species introduced in Legends: Arceus get the Hisui label.
export const HISUI_SPECIES_IDS = new Set([899, 900, 901, 902, 903, 904, 905]);

// Canonical species-per-generation counts, used as a hard data check.
export const GENERATION_COUNTS = {
  1: 151, 2: 100, 3: 135, 4: 107, 5: 156, 6: 72, 7: 88, 8: 96, 9: 120,
};
