import { apiError } from '@/http.js';
import * as reviewRepo from './review.repository.js';
import { decodeReviewCursor, reviewCursor } from './review.utils.js';
import type { ReviewQuery } from './review.types.js';

export const listReviewProjects = async (
  userId: string,
  projectId?: string,
) => {
  const projects = await reviewRepo.findReviewProjects(userId);
  if (projectId && !projects.some((project) => project.id === projectId))
    throw apiError(404, 'not_found', 'Project not found');
  return projects;
};
export const listReviewItems = async (userId: string, query: ReviewQuery) => {
  const projects = await listReviewProjects(userId, query.projectId);
  const rows = await reviewRepo.findReviewItems(
    userId,
    query,
    decodeReviewCursor(query.cursor),
  );
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    projects,
    items: page.map((row) => ({
      id: row.id,
      key: `${row.project.keyPrefix}-${row.number}`,
      title: row.title,
      kind: row.kind,
      priority: row.priority,
      project: row.project,
      state: row.state,
      assignee: row.assignee,
      available: true,
    })),
    nextCursor:
      rows.length > query.limit && last
        ? reviewCursor(last.updatedAt, last.id)
        : null,
  };
};
