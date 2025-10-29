import React from 'react';

export default function ColorPicker({
  value,
  onChange
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label aria-label="Selector de color">
      Color:
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 48, height: 32, marginLeft: 8, verticalAlign: 'middle' }}
      />
      <input
        aria-label="Hex"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
        title="Formato HEX (#RRGGBB)"
        style={{ marginLeft: 8, width: 100 }}
      />
    </label>
  );
}
