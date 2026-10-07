/** Why the checklist limits are invalid, or null when they are fine (null = no limit). */
export const limitsError = (min: number | null, max: number | null) => {
  if ((min !== null && min < 1) || (max !== null && max < 1))
    return 'Checklist limits must be at least 1, or empty for no limit';
  if (min !== null && max !== null && min > max)
    return `The minimum (${min}) can't be above the maximum (${max})`;
  return null;
};
