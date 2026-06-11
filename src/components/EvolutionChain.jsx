import { Link } from 'react-router-dom';
import { padId } from '../lib/format.js';

function EvoChip({ id, name, current }) {
  const body = (
    <>
      <img src={`${import.meta.env.BASE_URL}sprites/${id}.png`} alt="" width="64" height="64" loading="lazy" />
      <span className="evo-chip-name">{name}</span>
      <span className="evo-chip-id">{padId(id)}</span>
    </>
  );
  if (current) return <div className="evo-chip evo-chip--self">{body}</div>;
  return (
    <Link to={`/pokemon/${id}`} className="evo-chip">
      {body}
    </Link>
  );
}

// Megas have no Pokédex page of their own — the chip links back to the base
// species (e.g. Mega Charizard X → Charizard) unless we're already there.
function MegaChip({ mega, currentId }) {
  const body = (
    <>
      <img
        src={`${import.meta.env.BASE_URL}sprites/${mega.id}.png`}
        alt=""
        width="64"
        height="64"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.src = `${import.meta.env.BASE_URL}sprites/${mega.ofId}.png`;
          e.currentTarget.onerror = null;
        }}
      />
      <span className="evo-chip-name">{mega.name}</span>
      <span className="evo-chip-mega-tag">Mega</span>
    </>
  );
  if (mega.ofId === currentId) return <div className="evo-chip evo-chip--mega">{body}</div>;
  return (
    <Link to={`/pokemon/${mega.ofId}`} className="evo-chip evo-chip--mega">
      {body}
    </Link>
  );
}

const STAGE_LABELS = ['Base form', 'Stage 1', 'Stage 2'];

export default function EvolutionChain({ detail }) {
  const stages = detail.family?.stages ?? [[{ id: detail.id, name: detail.name }]];
  const megas = detail.family?.megas ?? [];

  return (
    <section className="evo">
      <h3>Family &amp; Evolutions</h3>
      <div className="evo-row">
        {stages.map((stage, i) => (
          <div key={i} className="evo-segment">
            {i > 0 && <div className="evo-arrow" aria-hidden="true">→</div>}
            <div className="evo-group">
              <h4>{STAGE_LABELS[i] ?? `Stage ${i}`}</h4>
              <div className="evo-targets">
                {stage.map((member) => (
                  <EvoChip key={member.id} {...member} current={member.id === detail.id} />
                ))}
              </div>
            </div>
          </div>
        ))}
        {megas.length > 0 && (
          <div className="evo-segment">
            <div className="evo-arrow evo-arrow--mega" aria-hidden="true">⇢</div>
            <div className="evo-group">
              <h4 className="evo-mega-heading">Mega Evolution</h4>
              <div className="evo-targets">
                {megas.map((mega) => (
                  <MegaChip key={mega.id} mega={mega} currentId={detail.id} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      {stages.length === 1 && stages[0].length === 1 && megas.length === 0 && (
        <p className="muted">This Pokémon does not evolve.</p>
      )}
    </section>
  );
}
