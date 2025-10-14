export default function LoadingScreen() {
  return (
    <>
      <div
        role={'status'}
        aria-live={'polite'}
        style={{
          position: 'fixed',
          inset: 0,
          background: '#000',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '5rem',
          zIndex: 9999
        }}
      >
        Loading ...
      </div>
    </>
  );
}
