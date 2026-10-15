import type { DocumentKind, DocumentStatus } from '@/generated/prisma/enums.js';

/** For an ADR: the statuses each status may move to. */
const ADR_MOVES: Partial<Record<DocumentStatus, DocumentStatus[]>> = {
  PROPOSED: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['SUPERSEDED'],
};

/** For tech debt: an open record is fixed or dropped, and then it stays closed. */
const TECH_DEBT_MOVES: Partial<Record<DocumentStatus, DocumentStatus[]>> = {
  OPEN: ['FIXED', 'WONT_FIX'],
};

/**
 * Why a `kind` document can't move from status `from` to `to`, or null when it can.
 * Statuses are rules, not database constraints (ADR-0014). ADRs and tech debt have them.
 */
export const nextStatusError = (
  kind: DocumentKind,
  from: DocumentStatus | null,
  to: DocumentStatus,
) => {
  if (kind === 'ADR') {
    if (from && ADR_MOVES[from]?.includes(to)) return null;
    return `An ADR can't move from ${from ?? 'no status'} to ${to}`;
  }
  if (kind === 'TECH_DEBT') {
    if (from && TECH_DEBT_MOVES[from]?.includes(to)) return null;
    return `Tech debt can't move from ${from ?? 'no status'} to ${to}`;
  }
  return 'Only ADRs and tech debt have a status';
};

/** ADRs and tech debt are closed by their status, never archived. */
export const isArchivable = (kind: DocumentKind) => {
  return kind !== 'ADR' && kind !== 'TECH_DEBT';
};

/** Provenance is optional; only specs can name an active Knowledge proposal. */
export const sourceProposalError = (
  kind: DocumentKind,
  sourceId: string | null | undefined,
  source: {
    id: string;
    projectId: string;
    kind: DocumentKind;
    homeItemId: string | null;
    archivedAt: Date | null;
  } | null,
  projectId: string,
  currentSourceId?: string | null,
) => {
  if (sourceId === undefined) return null;
  if (kind !== 'SPEC') return 'invalid_source_proposal';
  if (sourceId === null) return null;
  if (!source || source.projectId !== projectId) return 'not_found';
  if (source.kind !== 'PROPOSAL' || source.homeItemId)
    return 'invalid_source_proposal';
  if (source.archivedAt && source.id !== currentSourceId)
    return 'document_archived';
  return null;
};
