import Globe from '@/components/three/Globe.tsx';
import LoadingScreen from '@/components/ui/LoadingScreen.tsx';
import { useEffect, useState } from 'react';

export default function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onLoad = () => setLoading(false);
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return (
    <>
      {loading && <LoadingScreen />}
      <Globe />
    </>
  );
}
