import type { LabelColor, StateCategory } from '@/generated/prisma/enums.js';

export interface PresetState {
  name: string;
  key: string | null;
  category: StateCategory;
}

export interface PresetLabel {
  name: string;
  color: LabelColor;
  group: string;
}
