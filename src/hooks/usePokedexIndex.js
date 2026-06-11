import { useEffect, useState } from 'react';

let cached = null;
let pending = null;

export function loadIndex() {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = fetch(`${import.meta.env.BASE_URL}data/pokedex-index.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load Pokédex index (HTTP ${r.status})`);
        return r.json();
      })
      .then((data) => {
        cached = data;
        return data;
      });
  }
  return pending;
}

export function usePokedexIndex() {
  const [index, setIndex] = useState(cached);
  const [error, setError] = useState(null);
  useEffect(() => {
    let live = true;
    loadIndex().then(
      (data) => live && setIndex(data),
      (err) => live && setError(err)
    );
    return () => {
      live = false;
    };
  }, []);
  return { index, error, loading: !index && !error };
}
