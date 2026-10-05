import type { Context } from 'hono';
import { apiSuccess, idParam, parseBody } from '@/http.js';
import { createProjectSchema } from './project.schema.js';
import { createProject, getProject, listProjects } from './project.service.js';

export const postProject = async (c: Context) => {
  const input = await parseBody(c, createProjectSchema);
  return apiSuccess(
    c,
    await createProject(c.var.user.id, input),
    'Project created',
    201,
  );
};

export const getProjects = async (c: Context) =>
  apiSuccess(c, await listProjects(c.var.user.id));

export const getProjectById = async (c: Context) =>
  apiSuccess(c, await getProject(idParam(c, 'projectId'), c.var.user.id));
