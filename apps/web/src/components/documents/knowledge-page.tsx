"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { DocumentList } from "@/components/documents/document-list";
import {
  DOCUMENT_KIND,
  type DocumentKind,
} from "@/components/documents/document-meta";
import { NewDocumentButton } from "@/components/documents/new-document-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useListDocuments } from "@/lib/api/generated/documents/documents";
import { useGetProject } from "@/lib/api/generated/projects/projects";

type KindFilter = DocumentKind | "ALL";

/** The project's library: kind tabs with counts, title search, archived toggle. */
export const KnowledgePage = ({ projectId }: { projectId: string }) => {
  const [kind, setKind] = useState<KindFilter>("ALL");
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [ticketDocuments, setTicketDocuments] = useState(false);
  const q = search.trim();
  const { data: project } = useGetProject(projectId, {
    query: { select: (r) => r.data },
  });
  const { data, error, isPending, refetch } = useListDocuments(
    projectId,
    {
      ...(q && { q }),
      ...(archived && { archived: "true" as const }),
      ...(ticketDocuments && { includeTicketDocuments: "true" as const }),
    },
    {
      query: {
        select: (r) => r.data,
        placeholderData: keepPreviousData,
        retry: false,
      },
    },
  );
  const count = (k: KindFilter) =>
    k === "ALL"
      ? (data?.length ?? 0)
      : (data?.filter((d) => d.kind === k).length ?? 0);
  const shown = data?.filter((d) => kind === "ALL" || d.kind === kind) ?? [];
  // Only when the visible list is empty: are there archived documents behind it?
  const hiddenCheck = useListDocuments(
    projectId,
    { archived: "true" },
    {
      query: {
        select: (r) => r.data,
        enabled: !archived && q === "" && data?.length === 0,
        retry: false,
      },
    },
  );
  const hasHidden = !archived && (hiddenCheck.data?.length ?? 0) > 0;
  const canCreate = project?.canCreateDocuments === true;
  const filtering = q !== "" || kind !== "ALL";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge</h1>
          <p className="text-muted-foreground">
            Briefs, proposals, specs and reference notes live here, with ADRs
            and tech debt in Guided projects. Slice designs live in their item.
          </p>
        </div>
        {canCreate && <NewDocumentButton projectId={projectId} />}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={kind} onValueChange={(v) => setKind(v as KindFilter)}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="ALL">All ({count("ALL")})</TabsTrigger>
            {(project?.documentKinds ?? []).map((k) => (
              <TabsTrigger key={k} value={k}>
                {k === "ADR" ? "ADRs" : DOCUMENT_KIND[k].label} ({count(k)})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <Input
            aria-label="Search titles"
            placeholder="Search titles"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Show archived
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={ticketDocuments}
            onChange={(e) => setTicketDocuments(e.target.checked)}
          />
          Show ticket documents
        </label>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-xl border border-destructive/40 p-6"
        >
          <p>{error.message}</p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}
      {isPending && !error && (
        <div className="flex flex-col gap-2" aria-label="Loading documents">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      )}
      {data && shown.length === 0 && !filtering && hasHidden && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
          <p className="font-semibold">Archived documents are hidden</p>
          <p className="text-muted-foreground">
            Every document here is archived. Turn on Show archived to see them.
          </p>
        </div>
      )}
      {data && shown.length === 0 && !filtering && !hasHidden && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="font-semibold">No documents yet</p>
          <p className="text-muted-foreground">
            {canCreate
              ? "Start with a brief or a reference note for the team."
              : "An owner or manager can add the first one."}
          </p>
          {canCreate && <NewDocumentButton projectId={projectId} />}
        </div>
      )}
      {data && shown.length === 0 && filtering && (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          No documents match.
        </p>
      )}
      {shown.length > 0 && (
        <DocumentList projectId={projectId} documents={shown} />
      )}
    </main>
  );
};
