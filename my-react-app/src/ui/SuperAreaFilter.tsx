import { useState } from 'react';

type Values = { americas: boolean; apac: boolean; emea: boolean };
type Props = {
  values?: Values;
  onChange?: (v: Values) => void;
};

function SuperAreaFilter({ values, onChange }: Props) {
  const [v, setV] = useState<Values>(values ?? { americas: false, apac: false, emea: false });

  const toggle = (key: keyof Values) => {
    const next = { ...v, [key]: !v[key] };
    setV(next);
    onChange?.(next);
  };

  return (
    <div
      style={{
        padding: 12,
        background: 'rgba(10, 14, 23, 0.9)',
        color: '#e8e8e8',
        border: '1px solid #2b2f3a',
        borderRadius: 8,
        fontFamily: 'system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        fontSize: 14,
        lineHeight: 1.2,
        userSelect: 'none',
        width: 140
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Super Area</div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <input type="checkbox" checked={v.americas} onChange={() => toggle('americas')} />
        <span>Americas</span>
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <input type="checkbox" checked={v.apac} onChange={() => toggle('apac')} />
        <span>APAC</span>
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={v.emea} onChange={() => toggle('emea')} />
        <span>EMEA</span>
      </label>
    </div>
  );
}

export default SuperAreaFilter;
