"use client";

import Link from "next/link";
import { DOCUMENT_TEMPLATES } from "@/components/documents/document-templates";
import { DocumentForm } from "@/components/documents/document-form";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetDocument } from "@/lib/api/generated/documents/documents";
import { useGetProject } from "@/lib/api/generated/projects/projects";

/** The new-document page (no `documentId`) or the edit page; the API decides who may. */
export const DocumentEditor = ({
  projectId,
  documentId,
}: {
  projectId: string;
  documentId?: string;
}) => {
  const { data: project } = useGetProject(projectId, {
    query: { select: (r) => r.data },
  });
  const { data: document, error } = useGetDocument(documentId ?? "", {
    query: { select: (r) => r.data, enabled: !!documentId, retry: false },
  });
  const allowed = documentId ? document?.canEdit : project?.canCreateDocuments;
  const ready = documentId ? !!document : !!project;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        {documentId ? "Edit document" : "New document"}
      </h1>
      {error && <p role="alert">{error.message}</p>}
      {!ready && !error && <Skeleton className="h-96 w-full rounded-xl" />}
      {ready && !allowed && (
        <p role="alert" className="text-muted-foreground">
          {documentId
            ? "Only the author, an owner or a manager can edit this document. "
            : "Only owners and managers can write documents. "}
          <Link
            href={`/p/${projectId}/docs${documentId ? `/${documentId}` : ""}`}
            className="underline"
          >
            Go back
          </Link>
        </p>
      )}
      {ready && allowed && (
        <DocumentForm
          projectId={projectId}
          documentId={documentId}
          initial={
            document ?? {
              kind: "BRIEF",
              title: "",
              purpose: "",
              body: DOCUMENT_TEMPLATES.BRIEF,
            }
          }
        />
      )}
    </main>
  );
};
