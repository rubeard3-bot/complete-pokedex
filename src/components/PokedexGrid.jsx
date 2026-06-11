import PokemonTile from './PokemonTile.jsx';

export default function PokedexGrid({ pokemon }) {
  if (!pokemon.length) return <p className="status-msg">No Pokémon match those filters.</p>;
  return (
    <div className="pokedex-grid">
      {pokemon.map((p) => (
        <PokemonTile key={p.id} pokemon={p} />
      ))}
    </div>
  );
}
