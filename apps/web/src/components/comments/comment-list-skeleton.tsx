import { Skeleton } from "@/components/ui/skeleton";

/** Three comment-shaped rows while the thread loads. */
export const CommentListSkeleton = () => {
  return (
    <div className="space-y-4 py-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="border-b pb-4 last:border-b-0">
          <div className="mb-3 flex items-center gap-2.5">
            <Skeleton className="size-7" />
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="space-y-2 pl-9">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3.5 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
};
