import { HTTPException } from 'hono/http-exception';
import type { toEntry } from '@/modules/items/item.utils.js';
import type { getDocument } from '@/modules/documents/document.service.js';

/** BETTER_AUTH_URL is the configured website origin, not the incoming API host. */
export const toWebsiteUrl = (path: string) =>
  new URL(path, process.env.BETTER_AUTH_URL).href;

/** Saves confirm identity; get_document remains the source of full document detail. */
export const toDocumentConfirmation = (
  document: Awaited<ReturnType<typeof getDocument>>,
) => ({
  id: document.id,
  kind: document.kind,
  title: document.title,
  number: document.number,
  status: document.status,
  sourceProposalId: document.sourceProposalId,
  url: toWebsiteUrl(`/p/${document.projectId}/docs/${document.id}`),
});

/** A tool answer: the data as JSON text. */
export const reply = (data: unknown) => {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
};

const toolError = (text: string) => {
  return { isError: true, content: [{ type: 'text' as const, text }] };
};

/**
 * Turns an apiError into a tool error, `code: message`, so the agent sees the same
 * reason the website shows. Anything else is a bug: it is logged, and the agent gets
 * the website's 500 text. Rethrowing would not help: the SDK catches it and sends the
 * raw message (e.g. a Prisma error) to the agent.
 */
export const toToolError = async (error: unknown) => {
  if (!(error instanceof HTTPException) || !error.res) {
    console.error(error);
    return toolError('internal_error: Something went wrong');
  }
  const body = (await error.res.clone().json()) as {
    code: string;
    message: string;
  };
  return toolError(`${body.code}: ${body.message}`);
};

/** The checklist as an agent reads it: numbered from 1, the number get_criteria uses. */
export const toCriteria = (checklist: ReturnType<typeof toEntry>[]) => {
  return checklist.map((entry, index) => ({
    number: index + 1,
    text: entry.text,
    done: entry.done,
    evidence: entry.evidence,
  }));
};
