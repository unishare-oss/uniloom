import type { StateCategory } from '@/generated/prisma/enums.js';

export interface PresetState {
  name: string;
  key: string | null;
  category: StateCategory;
}
