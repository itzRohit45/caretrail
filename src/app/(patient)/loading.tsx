import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-6">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-5 w-full" />
      <div className="space-y-3">
        <Skeleton className="h-28 w-full rounded-card" />
        <Skeleton className="h-28 w-full rounded-card" />
      </div>
    </div>
  );
}
