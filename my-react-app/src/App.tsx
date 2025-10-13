import Globe from '@/three/components/Globe';
import SuperAreaFilter from '@/ui/SuperAreaFilter.tsx';
import superAreas from '@/data/super_areas.json';
import { useState } from 'react';

export default function App() {
  const [filter, setFilter] = useState({ americas: false, apac: false, emea: false });

  const highlightByRegion = {
    americas: filter.americas ? superAreas.americas : [],
    apac: filter.apac ? superAreas.apac : [],
    emea: filter.emea ? superAreas.emea : []
  };

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Globe highlightByRegion={highlightByRegion} />
      <div style={{ position: 'fixed', top: 12, left: 12, zIndex: 10 }}>
        <SuperAreaFilter values={filter} onChange={setFilter} />
      </div>
    </div>
  );
}
