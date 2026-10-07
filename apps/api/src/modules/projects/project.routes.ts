import { Hono } from 'hono';
import { z } from 'zod';
import { describe } from '@/openapi.js';
import {
  getProjectById,
  getProjects,
  patchProject,
  postProject,
} from './project.handlers.js';
import {
  createProjectSchema,
  projectDetailSchema,
  projectSchema,
  updateProjectSchema,
} from './project.schema.js';

/** The signed-in user's projects. */
export const projectRoutes = new Hono();

projectRoutes.post(
  '/',
  describe({
    tag: 'projects',
    operationId: 'createProject',
    summary: "Create a project with its mode's states; you become its owner",
    body: createProjectSchema,
    data: projectSchema,
    status: 201,
  }),
  postProject,
);
projectRoutes.get(
  '/',
  describe({
    tag: 'projects',
    operationId: 'listProjects',
    summary: 'Your projects',
    data: z.array(projectSchema),
  }),
  getProjects,
);
projectRoutes.get(
  '/:projectId',
  describe({
    tag: 'projects',
    operationId: 'getProject',
    summary: 'A project with its states in board order',
    pathParams: ['projectId'],
    data: projectDetailSchema,
  }),
  getProjectById,
);
projectRoutes.patch(
  '/:projectId',
  describe({
    tag: 'projects',
    operationId: 'updateProject',
    summary:
      "Change a project's name, rule switches and checklist limits (owners)",
    pathParams: ['projectId'],
    body: updateProjectSchema,
    data: projectSchema,
  }),
  patchProject,
);
