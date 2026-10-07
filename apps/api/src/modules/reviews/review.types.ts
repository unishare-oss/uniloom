export type ReviewQuery = {
  projectId?: string;
  cursor?: string;
  limit: number;
};
export type ReviewCursor = { at: Date; id: string };
