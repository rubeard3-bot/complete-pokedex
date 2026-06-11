import { ALL_TYPES, GENERATIONS, titleCase } from '../lib/format.js';

export default function FilterBar({ search, gen, type, favs, onChange, shown, total }) {
  return (
    <div className="filter-bar">
      <input
        type="search"
        className="filter-search"
        placeholder="Search by name or number…"
        value={search}
        onChange={(e) => onChange('q', e.target.value)}
        aria-label="Search Pokémon"
      />
      <select value={gen} onChange={(e) => onChange('gen', e.target.value)} aria-label="Filter by region">
        <option value="">All regions</option>
        {GENERATIONS.map(({ gen: g, region }) => (
          <option key={g} value={g}>
            Gen {g} — {region}
          </option>
        ))}
      </select>
      <select value={type} onChange={(e) => onChange('type', e.target.value)} aria-label="Filter by type">
        <option value="">All types</option>
        {ALL_TYPES.map((t) => (
          <option key={t} value={t}>
            {titleCase(t)}
          </option>
        ))}
      </select>
      <label className="filter-favs">
        <input type="checkbox" checked={favs} onChange={(e) => onChange('favs', e.target.checked ? '1' : '')} />
        ⭐ Fan favorites
      </label>
      <span className="filter-count">
        {shown === total ? `${total} Pokémon` : `${shown} of ${total}`}
      </span>
    </div>
  );
}
