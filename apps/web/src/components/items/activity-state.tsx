import type { StateCategory } from "@/components/items/item-meta";
import { StateLozenge } from "@/components/items/state-lozenge";

/**
 * A state named in an activity row, in its board colour. Rows keep the name from the time
 * of the move, so a state renamed since then shows neutral.
 */
export const ActivityState = ({
  name,
  states,
}: {
  name: string;
  states: { name: string; key: string | null; category: StateCategory }[];
}) => {
  const state = states.find((s) => s.name === name);
  return (
    <StateLozenge
      name={name}
      category={state?.category}
      stateKey={state?.key}
    />
  );
};
