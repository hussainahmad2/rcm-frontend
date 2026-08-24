import { Hexagon } from 'lucide-react';
import './Brand.css';

export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <span className="brand" style={dark ? { color: 'hsl(var(--primary))' } : undefined}>
      <span className="brand-mark" aria-hidden="true">
        <Hexagon size={16} strokeWidth={2.4} />
      </span>
      <span>
        Velora <span style={{ opacity: 0.55 }}>Desk</span>
      </span>
    </span>
  );
}

export default Brand;
