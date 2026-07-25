import { useState } from "react";
import { Check, Plus, RefreshCw } from "lucide-react";
import type { Task } from "@teamsync/shared";
import { Button, EmptyState, Skeleton } from "@/components/ui";

export function TaskPanel({
  tasks,
  loading,
  onRefresh,
  onCreate,
  onComplete,
}: {
  tasks: Task[];
  loading: boolean;
  onRefresh: () => void;
  onCreate: (title: string) => Promise<boolean>;
  onComplete: (taskId: string) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Assigned tasks
        </h2>
        <Button variant="ghost" className="h-8 px-2" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void (async () => {
            setBusy(true);
            const ok = await onCreate(title);
            if (ok) setTitle("");
            setBusy(false);
          })();
        }}
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="New task title…"
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <Button type="submit" disabled={busy || !title.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No open tasks"
          description="Create a task or get assigned one from the web app."
        />
      ) : (
        <ul className="max-h-40 space-y-1.5 overflow-y-auto">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-100">{task.title}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  {task.priority} · {task.status.replace("_", " ")}
                </p>
              </div>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => {
                  void onComplete(task.id);
                }}
                aria-label="Mark complete"
              >
                <Check className="h-4 w-4 text-emerald-400" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
