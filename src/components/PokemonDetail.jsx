import { Link, useParams } from 'react-router-dom';
import { usePokemonDetail } from '../hooks/usePokemonDetail.js';
import { padId } from '../lib/format.js';
import TypeBadge from './TypeBadge.jsx';
import EvolutionChain from './EvolutionChain.jsx';
import CardGallery from './CardGallery.jsx';

const MAX_ID = 1025;

export default function PokemonDetail() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const { detail, error, loading } = usePokemonDetail(id);

  if (!Number.isInteger(id) || id < 1 || id > MAX_ID) {
    return <p className="status-msg error">Invalid Pokémon number.</p>;
  }
  if (loading) return <p className="status-msg">Loading {padId(id)}…</p>;
  if (error) return <p className="status-msg error">{error.message}</p>;

  return (
    <article className="detail">
      <nav className="detail-nav">
        <Link to="/" className="nav-link">← All Pokémon</Link>
        <span>
          {id > 1 && (
            <Link to={`/pokemon/${id - 1}`} className="nav-link">‹ {padId(id - 1)}</Link>
          )}
          {id < MAX_ID && (
            <Link to={`/pokemon/${id + 1}`} className="nav-link">{padId(id + 1)} ›</Link>
          )}
        </span>
      </nav>

      <section className="detail-hero">
        <div className="detail-art">
          {detail.artworkUrl ? (
            <img
              src={detail.artworkUrl}
              alt={detail.name}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.src = `${import.meta.env.BASE_URL}sprites/${id}.png`;
                e.currentTarget.onerror = null;
              }}
            />
          ) : (
            <img src={`${import.meta.env.BASE_URL}sprites/${id}.png`} alt={detail.name} />
          )}
        </div>
        <div className="detail-info">
          <span className="detail-id">{padId(detail.id)}</span>
          <h2 className="detail-name">{detail.name}</h2>
          <div className="detail-types">
            {detail.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
          {detail.description && <p className="detail-description">{detail.description}</p>}
          <dl className="detail-facts">
            <div>
              <dt>Family / region</dt>
              <dd>
                {detail.region} <span className="muted">(Generation {detail.generation})</span>
              </dd>
            </div>
            <div>
              <dt>Fan favorite</dt>
              <dd>
                {detail.favoriteRank != null ? (
                  <span className="fav-chip">⭐ Yes — ranked #{detail.favoriteRank} in the 2020 Pokémon of the Year poll</span>
                ) : (
                  <span className="muted">Not in the top 30 of the 2020 poll</span>
                )}
              </dd>
            </div>
          </dl>
          {detail.flavorText && <p className="detail-flavor">{detail.flavorText}</p>}
        </div>
      </section>

      <EvolutionChain detail={detail} />
      <CardGallery detail={detail} />
    </article>
  );
}
