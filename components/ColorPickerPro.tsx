import React from "react";
import { HexColorPicker, HexColorInput } from "react-colorful";
import "react-colorful/dist/index.css";

type Props = {
  value: string;                           // ej. "#ff0066"
  onChange: (hex: string) => void;
  recent?: string[];                       // paleta reciente opcional
  onPickRecent?: (hex: string) => void;
};

const ColorPickerPro: React.FC<Props> = ({ value, onChange, recent = [], onPickRecent }) => {
  return (
    <div className="cp-root" aria-label="Selector de color">
      <HexColorPicker color={value} onChange={onChange} />
      <div className="cp-row">
        <span>#</span>
        <HexColorInput
          color={value}
          onChange={onChange}
          prefixed
          aria-label="Código HEX"
          className="cp-input"
        />
        <div className="cp-preview" style={{ background: value }} aria-hidden />
      </div>
      {recent.length > 0 && (
        <div className="cp-recent">
          {recent.map((c, i) => (
            <button
              key={`${c}-${i}`}
              className="cp-swatch"
              style={{ backgroundColor: c }}
              title={c}
              aria-label={`Usar color ${c}`}
              onClick={() => onPickRecent?.(c)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ColorPickerPro;

