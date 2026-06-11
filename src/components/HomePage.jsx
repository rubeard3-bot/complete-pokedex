import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePokedexIndex } from '../hooks/usePokedexIndex.js';
import FilterBar from './FilterBar.jsx';
import PokedexGrid from './PokedexGrid.jsx';

export default function HomePage() {
  const { index, error, loading } = usePokedexIndex();
  const [params, setParams] = useSearchParams();

  const search = params.get('q') ?? '';
  const gen = params.get('gen') ?? '';
  const type = params.get('type') ?? '';
  const favs = params.get('favs') === '1';

  function update(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const filtered = useMemo(() => {
    if (!index) return [];
    const q = search.trim().toLowerCase();
    return index.filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q) || String(p.id) === q) &&
        (!gen || p.generation === Number(gen)) &&
        (!type || p.types.includes(type)) &&
        (!favs || p.favoriteRank != null)
    );
  }, [index, search, gen, type, favs]);

  if (loading) return <p className="status-msg">Loading Pokédex…</p>;
  if (error) {
    return (
      <p className="status-msg error">
        Could not load Pokédex data ({error.message}). Run <code>npm run update-data</code> first.
      </p>
    );
  }

  return (
    <>
      <FilterBar
        search={search}
        gen={gen}
        type={type}
        favs={favs}
        onChange={update}
        shown={filtered.length}
        total={index.length}
      />
      <PokedexGrid pokemon={filtered} />
    </>
  );
}
