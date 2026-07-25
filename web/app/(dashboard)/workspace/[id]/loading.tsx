import { Skeleton } from "@/components/ui/skeleton";

export default function WorkspaceLoading() {
  return (
    <div className="flex h-dvh min-h-0">
      <div className="hidden w-[240px] border-r border-border p-3 md:block">
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="mt-4 space-y-2">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border p-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="h-full min-h-[320px] w-full rounded-xl" />
        </div>
      </div>
      <div className="hidden w-[280px] border-l border-border p-4 lg:block">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="mt-4 h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}
