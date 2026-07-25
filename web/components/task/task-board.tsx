"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  CreateTaskButton,
  TaskCard,
} from "@/components/task/task-components";
import { useRealtimeTasks } from "@/hooks/useRealtimeTasks";
import {
  DEFAULT_TASK_FILTERS,
  filterTasks,
  sortTasks,
  type TaskBoardFilters,
} from "@/lib/realtimeTasks";
import type { Task, TaskStatus, WorkspaceMemberWithProfile } from "@/types";
import { STATUS_LABELS, cn } from "@/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_COLUMNS: TaskStatus[] = ["todo", "in_progress", "done"];

interface WorkspaceTaskBoardProps {
  workspaceId: string;
  initialTasks: Task[];
  members: WorkspaceMemberWithProfile[];
  currentUserId: string | null;
}

function memberLookupFrom(
  members: WorkspaceMemberWithProfile[]
): Record<string, { full_name: string | null; avatar_url: string | null }> {
  const lookup: Record<
    string,
    { full_name: string | null; avatar_url: string | null }
  > = {};
  for (const member of members) {
    lookup[member.user_id] = {
      full_name: member.profile?.full_name ?? null,
      avatar_url: member.profile?.avatar_url ?? null,
    };
  }
  return lookup;
}

export function WorkspaceTaskBoard({
  workspaceId,
  initialTasks,
  members,
  currentUserId,
}: WorkspaceTaskBoardProps) {
  const [filters, setFilters] = useState<TaskBoardFilters>(DEFAULT_TASK_FILTERS);
  const memberLookup = useMemo(() => memberLookupFrom(members), [members]);

  const {
    tasks,
    counters,
    isConnected,
    error,
    upsertLocalTask,
    removeLocalTask,
    noteLocalMutation,
    recordActivity,
  } = useRealtimeTasks({
    workspaceId,
    initialTasks,
    currentUserId,
    memberLookup,
    showToasts: false,
  });

  const handleTaskCommitted = (task: Task, previous: Task | null) => {
    upsertLocalTask(task);
    if (!previous) {
      recordActivity({
        kind: "created",
        message: `You created task “${task.title}”`,
        taskId: task.id,
      });
      return;
    }

    if (previous.status !== task.status) {
      recordActivity({
        kind: "status_changed",
        message:
          task.status === "done"
            ? `You completed task “${task.title}”`
            : `You moved “${task.title}” to ${STATUS_LABELS[task.status]}`,
        taskId: task.id,
      });
      return;
    }
    if (previous.priority !== task.priority) {
      recordActivity({
        kind: "priority_changed",
        message: `You changed priority of “${task.title}”`,
        taskId: task.id,
      });
      return;
    }
    if ((previous.assignee_id ?? null) !== (task.assignee_id ?? null)) {
      const assigneeName = task.assignee_id
        ? memberLookup[task.assignee_id]?.full_name?.split(/\s+/)[0] ?? "a teammate"
        : null;
      recordActivity({
        kind: "assigned",
        message: assigneeName
          ? `You assigned “${task.title}” to ${assigneeName}`
          : `You unassigned “${task.title}”`,
        taskId: task.id,
      });
      return;
    }
    recordActivity({
      kind: "updated",
      message: `You updated task “${task.title}”`,
      taskId: task.id,
    });
  };

  const handleTaskDeleted = (task: Task) => {
    recordActivity({
      kind: "deleted",
      message: `You deleted task “${task.title}”`,
      taskId: task.id,
    });
  };

  const visibleTasks = useMemo(
    () => sortTasks(filterTasks(tasks, filters), filters.sort),
    [filters, tasks]
  );

  const columns = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const task of visibleTasks) {
      map[task.status]?.push(task);
    }
    return map;
  }, [visibleTasks]);

  const showEmpty = tasks.length === 0;
  const showFilteredEmpty = !showEmpty && visibleTasks.length === 0;

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 px-4 py-3 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-semibold">Tasks</h2>
            <span
              className={cn(
                "inline-flex h-1.5 w-1.5 rounded-full",
                isConnected ? "bg-emerald-500" : "bg-amber-500"
              )}
              title={isConnected ? "Live" : "Reconnecting"}
              aria-label={isConnected ? "Live sync connected" : "Reconnecting"}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Todo ({counters.todo}) · In Progress ({counters.in_progress}) · Done (
            {counters.done})
            {error ? ` · ${error}` : null}
          </p>
        </div>
        <CreateTaskButton
          workspaceId={workspaceId}
          members={members}
          onOptimisticUpsert={upsertLocalTask}
          onLocalMutation={noteLocalMutation}
          onTaskCommitted={handleTaskCommitted}
        />
      </div>

      <div className="space-y-2.5 border-b border-border/70 px-4 py-3 sm:px-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.target.value }))
            }
            placeholder="Search tasks…"
            className="h-9 rounded-xl pl-8 text-sm"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            value={filters.priority}
            onValueChange={(value) =>
              setFilters((current) => ({
                ...current,
                priority: value as TaskBoardFilters["priority"],
              }))
            }
          >
            <SelectTrigger className="h-9 rounded-xl">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.status}
            onValueChange={(value) =>
              setFilters((current) => ({
                ...current,
                status: value as TaskBoardFilters["status"],
              }))
            }
          >
            <SelectTrigger className="h-9 rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="todo">Todo</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.assigneeId}
            onValueChange={(value) =>
              setFilters((current) => ({
                ...current,
                assigneeId: value as TaskBoardFilters["assigneeId"],
              }))
            }
          >
            <SelectTrigger className="h-9 rounded-xl">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.user_id} value={member.user_id}>
                  {member.profile?.full_name?.trim() ||
                    member.profile?.email ||
                    "Member"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.sort}
            onValueChange={(value) =>
              setFilters((current) => ({
                ...current,
                sort: value as TaskBoardFilters["sort"],
              }))
            }
          >
            <SelectTrigger className="h-9 rounded-xl">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">
          {showEmpty ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
              <h3 className="font-display text-base font-semibold">No tasks yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Add your first task to get this workspace moving.
              </p>
              <div className="mt-5 flex justify-center">
                <CreateTaskButton
                  workspaceId={workspaceId}
                  members={members}
                  onOptimisticUpsert={upsertLocalTask}
                  onLocalMutation={noteLocalMutation}
                  onTaskCommitted={handleTaskCommitted}
                />
              </div>
            </div>
          ) : showFilteredEmpty ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <h3 className="font-display text-base font-semibold">No matching tasks</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Try adjusting search or filters.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-3">
              {STATUS_COLUMNS.map((status) => (
                <div
                  key={status}
                  className="min-h-[12rem] rounded-xl border border-border/70 bg-muted/15 p-2.5 shadow-sm"
                >
                  <div className="mb-2.5 flex items-center justify-between px-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {STATUS_LABELS[status]}
                    </h3>
                    <span className="rounded-md bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {columns[status].length}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {columns[status].map((task) => (
                      <div key={task.id} className="animate-task-move">
                        <TaskCard
                          task={task}
                          workspaceId={workspaceId}
                          members={members}
                          currentUserId={currentUserId}
                          hideStatusBadge
                          onOptimisticUpsert={upsertLocalTask}
                          onOptimisticRemove={removeLocalTask}
                          onLocalMutation={noteLocalMutation}
                          onTaskCommitted={handleTaskCommitted}
                          onTaskDeleted={handleTaskDeleted}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
