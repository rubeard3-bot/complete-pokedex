import { formatPrice } from '../lib/format.js';

export default function CardGallery({ detail }) {
  const cards = detail.cards ?? [];
  const updated = detail.pricesUpdatedAt ? new Date(detail.pricesUpdatedAt).toLocaleDateString() : null;

  return (
    <section className="cards">
      <h3>
        Most valuable cards
        {updated && <span className="cards-updated">prices as of {updated}</span>}
      </h3>
      {!cards.length ? (
        <p className="muted">
          No trading cards found for {detail.name} — it may not have an English TCG print yet.
        </p>
      ) : (
        <ol className="card-list">
          {cards.map((c) => (
            <li key={c.cardId} className="card-item">
              <span className="card-rank">#{c.rank}</span>
              {c.thumbUrl ? (
                <a href={c.imageUrl ?? c.thumbUrl} target="_blank" rel="noreferrer" title="Open full-size card">
                  <img
                    src={c.thumbUrl}
                    alt={c.name}
                    className="card-img"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.visibility = 'hidden';
                    }}
                  />
                </a>
              ) : (
                <div className="card-img card-img--missing">no image</div>
              )}
              <div className="card-meta">
                <span className="card-name">{c.name}</span>
                <span className="card-set">
                  {c.set ?? 'Unknown set'}
                  {c.rarity ? ` · ${c.rarity}` : ''}
                </span>
                {c.variant && c.variant !== 'cardmarket' && (
                  <span className="card-variant">{c.variant.replace(/-/g, ' ')}</span>
                )}
              </div>
              <span className={`card-price${c.price == null ? ' muted' : ''}`}>
                {formatPrice(c.price, c.currency)}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="cards-note muted">
        Market prices via TCGdex (TCGPlayer USD; Cardmarket EUR fallback). The “pack” is the card’s set —
        e.g. a card from <em>Evolving Skies</em> comes from Evolving Skies booster packs.
      </p>
    </section>
  );
}
