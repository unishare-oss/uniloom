"use client";

import {
  LABEL_COLORS,
  labelColorName,
  type LabelColor,
} from "@/components/items/item-meta";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const colorOptions = LABEL_COLORS.map((color) => ({
  value: color,
  label: labelColorName(color),
}));

export const ColorSelect = ({
  value,
  onChange,
}: {
  value: LabelColor;
  onChange: (color: LabelColor) => void;
}) => {
  return (
    <Select
      value={value}
      onValueChange={(color) => onChange(color as LabelColor)}
      items={colorOptions}
    >
      <SelectTrigger aria-label="Colour" className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {colorOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
