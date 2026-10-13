import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const NewDocumentButton = ({ projectId }: { projectId: string }) => {
  return (
    <Button render={<Link href={`/p/${projectId}/docs/new`} />}>
      <Plus />
      New document
    </Button>
  );
};
