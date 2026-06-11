import { useEffect, useState } from 'react';

const cache = new Map();

export function usePokemonDetail(id) {
  const [state, setState] = useState({ id: null, detail: null, error: null });

  // Adjust state during render when the answer is already cached — avoids a
  // setState-in-effect cascade (https://react.dev/learn/you-might-not-need-an-effect).
  if (state.id !== id && cache.has(id)) {
    setState({ id, detail: cache.get(id), error: null });
  }

  useEffect(() => {
    if (cache.has(id)) return undefined;
    let live = true;
    fetch(`${import.meta.env.BASE_URL}data/pokemon/${id}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`No data for Pokémon #${id} (HTTP ${r.status})`);
        return r.json();
      })
      .then((data) => {
        cache.set(id, data);
        if (live) setState({ id, detail: data, error: null });
      })
      .catch((err) => {
        if (live) setState({ id, detail: null, error: err });
      });
    return () => {
      live = false;
    };
  }, [id]);

  const current = state.id === id ? state : { detail: null, error: null };
  return { detail: current.detail, error: current.error, loading: !current.detail && !current.error };
}
