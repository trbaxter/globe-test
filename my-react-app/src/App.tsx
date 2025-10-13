import Globe from '@/three/components/Globe';

export default function App() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Globe rendererConfig={{ antialias: true }} />
    </div>
  );
}
