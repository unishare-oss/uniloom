/** The MCP-only rule (MVP.md §9): agents never move an item to Ready or Done. */
export const isPeopleOnlyTarget = (state: {
  key: string | null;
  category: string;
}) => {
  return state.key === 'ready' || state.category === 'DONE';
};
