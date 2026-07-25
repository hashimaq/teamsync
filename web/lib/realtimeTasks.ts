import type { Task, TaskPriority, TaskStatus } from "@/types";

export const WORKSPACE_TASKS_CHANNEL = (workspaceId: string) =>
  `workspace-tasks:${workspaceId}`;

export type TaskActivityKind =
  | "created"
  | "updated"
  | "deleted"
  | "status_changed"
  | "priority_changed"
  | "assigned";

export type TaskActivityItem = {
  id: string;
  kind: TaskActivityKind;
  message: string;
  createdAt: string;
  taskId?: string;
};

export type TaskCounters = {
  todo: number;
  in_progress: number;
  done: number;
  total: number;
};

export type TaskBoardFilters = {
  search: string;
  priority: TaskPriority | "all";
  status: TaskStatus | "all";
  assigneeId: string | "all" | "unassigned";
  sort: "newest" | "oldest" | "priority";
};

export const DEFAULT_TASK_FILTERS: TaskBoardFilters = {
  search: "",
  priority: "all",
  status: "all",
  assigneeId: "all",
  sort: "newest",
};

const PRIORITY_RANK: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function upsertTask(tasks: Task[], incoming: Task): Task[] {
  const index = tasks.findIndex((task) => task.id === incoming.id);
  if (index === -1) {
    return [incoming, ...tasks];
  }
  const next = [...tasks];
  next[index] = { ...next[index], ...incoming };
  return next;
}

export function removeTaskById(tasks: Task[], taskId: string): Task[] {
  return tasks.filter((task) => task.id !== taskId);
}

export function countTasksByStatus(tasks: Task[]): TaskCounters {
  const counters: TaskCounters = {
    todo: 0,
    in_progress: 0,
    done: 0,
    total: tasks.length,
  };

  for (const task of tasks) {
    if (task.status === "todo") counters.todo += 1;
    else if (task.status === "in_progress") counters.in_progress += 1;
    else if (task.status === "done") counters.done += 1;
  }

  return counters;
}

export function sortTasks(tasks: Task[], sort: TaskBoardFilters["sort"]): Task[] {
  const next = [...tasks];
  next.sort((a, b) => {
    if (sort === "priority") {
      const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (rank !== 0) return rank;
    }

    const aTime = new Date(a.updated_at || a.created_at).getTime();
    const bTime = new Date(b.updated_at || b.created_at).getTime();
    return sort === "oldest" ? aTime - bTime : bTime - aTime;
  });
  return next;
}

export function filterTasks(tasks: Task[], filters: TaskBoardFilters): Task[] {
  const query = filters.search.trim().toLowerCase();

  return tasks.filter((task) => {
    if (filters.priority !== "all" && task.priority !== filters.priority) {
      return false;
    }
    if (filters.status !== "all" && task.status !== filters.status) {
      return false;
    }
    if (filters.assigneeId === "unassigned" && task.assignee_id) {
      return false;
    }
    if (
      filters.assigneeId !== "all" &&
      filters.assigneeId !== "unassigned" &&
      task.assignee_id !== filters.assigneeId
    ) {
      return false;
    }
    if (!query) return true;

    const haystack = `${task.title} ${task.description ?? ""}`.toLowerCase();
    return haystack.includes(query);
  });
}

export function buildTaskActivityMessage(params: {
  kind: TaskActivityKind;
  actorName: string;
  taskTitle?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeName?: string | null;
}): string {
  const { kind, actorName, taskTitle, status, priority, assigneeName } = params;
  const title = taskTitle ? `“${taskTitle}”` : "a task";

  switch (kind) {
    case "created":
      return `${actorName} created task ${title}`;
    case "deleted":
      return `${actorName} deleted task ${title}`;
    case "status_changed":
      if (status === "done") return `${actorName} completed task ${title}`;
      if (status === "in_progress") return `${actorName} moved ${title} to In Progress`;
      return `${actorName} moved ${title} to Todo`;
    case "priority_changed":
      return `${actorName} changed priority of ${title} to ${priority ?? "updated"}`;
    case "assigned":
      return assigneeName
        ? `${actorName} assigned ${title} to ${assigneeName}`
        : `${actorName} unassigned ${title}`;
    case "updated":
    default:
      return `${actorName} updated task ${title}`;
  }
}

export function detectTaskUpdateActivity(
  previous: Task | undefined,
  next: Task
): TaskActivityKind {
  if (!previous) return "updated";
  if (previous.status !== next.status) return "status_changed";
  if (previous.priority !== next.priority) return "priority_changed";
  if ((previous.assignee_id ?? null) !== (next.assignee_id ?? null)) {
    return "assigned";
  }
  return "updated";
}
