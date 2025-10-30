type Props = {
  value: string;
  onChange: (hex: string) => void;
};

const PRESETS = ["#ffffff", "#ffcc00", "#ff4d4f", "#36cfc9", "#1677ff", "#9c27b0", "#00e676", "#000000"];

export default function ColorPicker({ value, onChange }: Props) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 40, height: 32, background: "transparent", border: "1px solid #2a2a33", borderRadius: 6 }}
        aria-label="color"
      />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            title={c}
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              border: "1px solid #2a2a33",
              background: c,
              outline: value.toLowerCase() === c.toLowerCase() ? "2px solid #888" : "none",
              cursor: "pointer",
            }}
          />
        ))}
      </div>
      <span style={{ opacity: 0.7, fontSize: 12 }}>Color</span>
    </div>
  );
}
