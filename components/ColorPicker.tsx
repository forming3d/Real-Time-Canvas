import React from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function ColorPicker({ value, onChange }: Props) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label style={{ fontSize: 12, opacity: 0.8 }}>Color</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Color del pincel"
        style={{ width: 40, height: 32, border: 'none', background: 'transparent', cursor: 'pointer' }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Hex del color"
        spellCheck={false}
        style={{ background: '#0b1220', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '6px 8px' }}
      />
    </div>
  );
}
