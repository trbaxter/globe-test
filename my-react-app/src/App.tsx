import Globe from '@/three/components/Globe';
import SuperAreaFilter from '@/ui/SuperAreaFilter.tsx';
import { useState } from 'react';

export default function App() {
  const [filter, setFilter] = useState({ americas: false, apac: false, emea: false });

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Globe />
      <div style={{ position: 'fixed', top: 12, left: 12, zIndex: 10 }}>
        <SuperAreaFilter values={filter} onChange={setFilter} />
      </div>
    </div>
  );
}
