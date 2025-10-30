type Props = {
  size: number;
  onSizeChange: (n: number) => void;
};

export default function ControlPanel({ size, onSizeChange }: Props) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-end" }}>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, opacity: 0.7 }}>Grosor</span>
        <input
          type="range"
          min={1}
          max={40}
          value={size}
          onChange={(e) => onSizeChange(parseInt(e.target.value, 10))}
        />
        <code>{size}px</code>
      </label>
    </div>
  );
}
