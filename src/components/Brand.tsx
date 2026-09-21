import { Link } from 'react-router-dom';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="Manabi Admin 首页">
      <span className="brand__mark" lang="ja">学</span>
      {!compact && (
        <span className="brand__text">
          <strong>manabi</strong>
          <small>ADMIN</small>
        </span>
      )}
    </Link>
  );
}
