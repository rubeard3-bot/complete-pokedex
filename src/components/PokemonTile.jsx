import { Link } from 'react-router-dom';
import { padId } from '../lib/format.js';
import TypeBadge from './TypeBadge.jsx';

export default function PokemonTile({ pokemon: p }) {
  return (
    <Link to={`/pokemon/${p.id}`} className="tile">
      {p.favoriteRank != null && (
        <span className="tile-fav" title={`Fan favorite #${p.favoriteRank} (2020 Pokémon of the Year poll)`}>
          ⭐
        </span>
      )}
      <img
        src={`${import.meta.env.BASE_URL}${p.sprite}`}
        alt={p.name}
        width="96"
        height="96"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.visibility = 'hidden';
        }}
      />
      <span className="tile-id">{padId(p.id)}</span>
      <span className="tile-name">{p.name}</span>
      <span className="tile-types">
        {p.types.map((t) => (
          <TypeBadge key={t} type={t} small />
        ))}
      </span>
    </Link>
  );
}
