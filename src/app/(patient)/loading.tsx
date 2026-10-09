import { Skeleton } from "@/components/ui/skeleton";
import { PageBody } from "@/components/ui/page";

export default function Loading() {
  return (
    <div role="status" aria-label="Loading">
      <div className="mx-auto max-w-4xl space-y-3 px-4 pt-8 pb-6 sm:px-6 md:pt-12 md:pb-8">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-11 w-2/3" />
        <Skeleton className="h-6 w-1/2" />
      </div>
      <PageBody>
        <Skeleton className="h-52 w-full rounded-card" />
        <Skeleton className="h-72 w-full rounded-card" />
      </PageBody>
    </div>
  );
}
