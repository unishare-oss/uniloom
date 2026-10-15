"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DOCUMENT_TEMPLATES } from "@/components/documents/document-templates";
import { type DocumentKind } from "@/components/documents/document-meta";
import { KindPicker } from "@/components/documents/kind-picker";
import { Markdown } from "@/components/markdown/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getGetDocumentQueryKey,
  getListDocumentsQueryKey,
  useCreateDocument,
  useUpdateDocument,
} from "@/lib/api/generated/documents/documents";
import { useGetProject } from "@/lib/api/generated/projects/projects";

/**
 * The write form: new (with the kind picker and the kind's template) or an existing
 * document (`documentId`, kind fixed). Markdown on the left, live preview on the right.
 */
export const DocumentForm = ({
  projectId,
  documentId,
  initial,
}: {
  projectId: string;
  documentId?: string;
  initial: {
    kind: DocumentKind;
    title: string;
    purpose: string;
    body: string;
  };
}) => {
  const router = useRouter();
  const { data: documentKinds } = useGetProject(projectId, {
    query: { select: (r) => r.data.creatableDocumentKinds },
  });
  const queryClient = useQueryClient();
  const [kind, setKind] = useState(initial.kind);
  const [title, setTitle] = useState(initial.title);
  const [purpose, setPurpose] = useState(initial.purpose);
  const [body, setBody] = useState(initial.body);

  const afterSave = async (id: string) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getListDocumentsQueryKey(projectId),
      }),
      queryClient.invalidateQueries({ queryKey: getGetDocumentQueryKey(id) }),
    ]);
    router.push(`/p/${projectId}/docs/${id}`);
  };
  const create = useCreateDocument({
    mutation: {
      onSuccess: (res) => afterSave(res.data.id),
      onError: (err) => toast.error(err.message),
    },
  });
  const update = useUpdateDocument({
    mutation: {
      onSuccess: (res) => afterSave(res.data.id),
      onError: (err) => toast.error(err.message),
    },
  });
  const saving = create.isPending || update.isPending;

  // Switching kind swaps the template in only while the body is still the untouched one.
  const pickKind = (next: DocumentKind) => {
    if (body === DOCUMENT_TEMPLATES[kind] || body === "")
      setBody(DOCUMENT_TEMPLATES[next]);
    setKind(next);
  };
  const save = () => {
    if (documentId)
      update.mutate({ id: documentId, data: { title, purpose, body } });
    else create.mutate({ projectId, data: { kind, title, purpose, body } });
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {!documentId && (
        <KindPicker
          kinds={documentKinds ?? []}
          value={kind}
          onChange={pickKind}
        />
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="document-title">Title</Label>
          <Input
            id="document-title"
            value={title}
            maxLength={200}
            required
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="document-purpose">Purpose</Label>
          <Input
            id="document-purpose"
            value={purpose}
            maxLength={300}
            placeholder="One line: why this document exists"
            onChange={(e) => setPurpose(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="document-body">Markdown</Label>
          <Textarea
            id="document-body"
            value={body}
            maxLength={100000}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-96 font-mono"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium">Preview</span>
          <div className="min-h-96 rounded-lg border bg-card p-4">
            <Markdown>{body}</Markdown>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving || title.trim() === ""}>
          {documentId ? "Save changes" : "Create document"}
        </Button>
        <Button
          variant="outline"
          render={
            <Link
              href={
                documentId
                  ? `/p/${projectId}/docs/${documentId}`
                  : `/p/${projectId}/docs`
              }
            />
          }
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};
