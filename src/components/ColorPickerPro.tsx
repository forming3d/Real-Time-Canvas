import React from "react";
import { HexColorPicker, HexColorInput } from "react-colorful";

export type ColorPickerProProps = {
  value: string;                    // #rrggbb
  onChange: (hex: string) => void;
  recent?: string[];                // paleta / recientes
  onPickRecent?: (hex: string) => void;
  disabled?: boolean;
};

const ColorPickerPro: React.FC<ColorPickerProProps> = ({
  value,
  onChange,
  recent = [],
  onPickRecent,
  disabled = false,
}) => {
  return (
    <div className="cp-root" aria-label="Selector de color">
      {/* Picker principal */}
      <div
        aria-disabled={disabled}
        style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}
      >
        <HexColorPicker color={value} onChange={onChange} />
      </div>

      {/* Input HEX + preview */}
      <div className="cp-row" role="group" aria-label="Entrada manual de color">
        <span>#</span>
        <HexColorInput
          color={value}
          onChange={onChange}
          prefixed
          aria-label="Código HEX"
          className="cp-input"
          disabled={disabled}
        />
        <div className="cp-preview" style={{ background: value }} aria-hidden />
      </div>

      {/* Swatches de recientes/paleta */}
      {recent.length > 0 && (
        <div className="cp-recent" role="list" aria-label="Colores recientes">
          {recent.map((c, i) => (
            <button
              key={`${c}-${i}`}
              className="cp-swatch"
              style={{ backgroundColor: c }}
              title={c}
              aria-label={`Usar color ${c}`}
              onClick={() => onPickRecent?.(c)}
              disabled={disabled}
              role="listitem"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ColorPickerPro;
