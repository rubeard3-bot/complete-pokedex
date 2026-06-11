import { titleCase } from '../lib/format.js';

export default function TypeBadge({ type, small = false }) {
  return (
    <span className={`type-badge${small ? ' type-badge--small' : ''}`} data-type={type}>
      {titleCase(type)}
    </span>
  );
}
