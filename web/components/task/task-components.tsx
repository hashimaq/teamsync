"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { createTask, deleteTask, updateTask, updateTaskStatus } from "@/actions/tasks";
import { taskSchema, type TaskInput } from "@/lib/validations";
import type { Task, TaskStatus, WorkspaceMemberWithProfile } from "@/types";
import {
  formatDate,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/utils";

function getInitials(name: string | null | undefined) {
  if (!name?.trim()) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function memberLabel(member: WorkspaceMemberWithProfile) {
  return member.profile?.full_name?.trim() || member.profile?.email || "Member";
}

export type TaskBoardMember = WorkspaceMemberWithProfile;

interface TaskMutationHandlers {
  onOptimisticUpsert?: (task: Task) => void;
  onOptimisticRemove?: (taskId: string) => void;
  onLocalMutation?: (taskId: string, event: "insert" | "update" | "delete") => void;
  onTaskCommitted?: (task: Task, previous: Task | null) => void;
  onTaskDeleted?: (task: Task) => void;
}

interface TaskFormDialogProps extends TaskMutationHandlers {
  workspaceId: string;
  task?: Task;
  members?: TaskBoardMember[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TaskFormDialog({
  workspaceId,
  task,
  members = [],
  trigger,
  open: controlledOpen,
  onOpenChange,
  onOptimisticUpsert,
  onLocalMutation,
  onTaskCommitted,
}: TaskFormDialogProps) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<TaskInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      priority: task?.priority ?? "medium",
      status: task?.status ?? "todo",
      due_date: task?.due_date ?? "",
      assignee_id: task?.assignee_id ?? "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    const formData = new FormData();
    formData.set("title", values.title);
    formData.set("description", values.description ?? "");
    formData.set("priority", values.priority);
    formData.set("status", values.status);
    formData.set("due_date", values.due_date ?? "");
    formData.set("assignee_id", values.assignee_id ?? "");

    // Optimistic preview for edits
    if (task && onOptimisticUpsert) {
      onOptimisticUpsert({
        ...task,
        title: values.title,
        description: values.description || null,
        priority: values.priority,
        status: values.status,
        due_date: values.due_date || null,
        assignee_id: values.assignee_id || null,
        updated_at: new Date().toISOString(),
      });
      onLocalMutation?.(task.id, "update");
    }

    startTransition(async () => {
      const result = task
        ? await updateTask(task.id, workspaceId, formData)
        : await createTask(workspaceId, formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      onLocalMutation?.(result.data.id, task ? "update" : "insert");
      onOptimisticUpsert?.(result.data);
      onTaskCommitted?.(result.data, task ?? null);

      reset(
        task
          ? {
              title: result.data.title,
              description: result.data.description ?? "",
              priority: result.data.priority,
              status: result.data.status,
              due_date: result.data.due_date ?? "",
              assignee_id: result.data.assignee_id ?? "",
            }
          : {
              title: "",
              description: "",
              priority: "medium",
              status: "todo",
              due_date: "",
              assignee_id: "",
            }
      );
      setOpen(false);
      router.refresh();
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "Create task"}</DialogTitle>
          <DialogDescription>
            {task
              ? "Update the details for this task."
              : "Add a new task to this workspace."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="Draft launch checklist" {...register("title")} />
            {errors.title ? (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional details"
              {...register("description")}
            />
            {errors.description ? (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">Todo</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="due_date">Due date</Label>
              <Input id="due_date" type="date" {...register("due_date")} />
            </div>
            <div className="space-y-2">
              <Label>Assignee</Label>
              <Controller
                control={control}
                name="assignee_id"
                render={({ field }) => (
                  <Select
                    value={field.value || "unassigned"}
                    onValueChange={(value) =>
                      field.onChange(value === "unassigned" ? "" : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {memberLabel(member)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? task
                  ? "Saving..."
                  : "Creating..."
                : task
                  ? "Save changes"
                  : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TaskCard({
  task,
  workspaceId,
  members = [],
  currentUserId = null,
  hideStatusBadge = false,
  onOptimisticUpsert,
  onOptimisticRemove,
  onLocalMutation,
  onTaskCommitted,
  onTaskDeleted,
}: {
  task: Task;
  workspaceId: string;
  members?: TaskBoardMember[];
  currentUserId?: string | null;
  hideStatusBadge?: boolean;
} & TaskMutationHandlers) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const [isStatusPending, startStatus] = useTransition();

  const assignee = members.find((member) => member.user_id === task.assignee_id);
  const creator = members.find((member) => member.user_id === task.created_by);
  const canDelete = Boolean(currentUserId && currentUserId === task.created_by);

  const handleStatusChange = (status: TaskStatus) => {
    if (status === task.status) return;
    const optimistic = { ...task, status, updated_at: new Date().toISOString() };
    onLocalMutation?.(task.id, "update");
    onOptimisticUpsert?.(optimistic);
    startStatus(async () => {
      const result = await updateTaskStatus(task.id, workspaceId, status);
      if (!result.success) {
        onOptimisticUpsert?.(task);
        return;
      }
      onTaskCommitted?.(result.data, task);
      router.refresh();
    });
  };

  return (
    <Card
      className={cn(
        "group rounded-xl border-border/80 bg-card shadow-sm transition duration-200",
        "hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md",
        "animate-task-card"
      )}
    >
      <CardHeader className="space-y-2 p-3.5 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="font-display text-sm font-semibold leading-snug">
            {task.title}
          </CardTitle>
          <div
            className={cn(
              "flex shrink-0 gap-0.5 transition",
              "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100"
            )}
          >
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              aria-label="Edit task"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {canDelete ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                aria-label="Delete task"
                disabled={isDeleting}
                onClick={() => {
                  if (!confirm("Delete this task?")) return;
                  onLocalMutation?.(task.id, "delete");
                  onOptimisticRemove?.(task.id);
                  onTaskDeleted?.(task);
                  startDelete(async () => {
                    const result = await deleteTask(task.id, workspaceId);
                    if (!result.success) {
                      onOptimisticUpsert?.(task);
                      return;
                    }
                    router.refresh();
                  });
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            ) : null}
          </div>
        </div>
        <CardDescription className="line-clamp-2 text-xs leading-relaxed">
          {task.description || "No description"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-3.5 pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={cn("text-[10px]", PRIORITY_COLORS[task.priority])}>
            {PRIORITY_LABELS[task.priority]}
          </Badge>
          {!hideStatusBadge ? (
            <Badge variant="outline" className={cn("text-[10px]", STATUS_COLORS[task.status])}>
              {STATUS_LABELS[task.status]}
            </Badge>
          ) : null}
          <Select
            value={task.status}
            disabled={isStatusPending}
            onValueChange={(value) => handleStatusChange(value as TaskStatus)}
          >
            <SelectTrigger
              className="h-7 w-auto min-w-[7.5rem] rounded-lg border-border/70 px-2 text-[10px] font-medium"
              aria-label="Change status"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">Todo</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            Due {formatDate(task.due_date)}
          </span>
          <span>Created {formatDate(task.created_at)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border/70 pt-2.5 text-[11px] text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Avatar className="h-6 w-6 border border-border/60">
              {creator?.profile?.avatar_url ? (
                <AvatarImage src={creator.profile.avatar_url} alt="" />
              ) : null}
              <AvatarFallback className="bg-muted text-[9px]">
                {getInitials(creator?.profile?.full_name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">
              {creator?.profile?.full_name?.split(/\s+/)[0] ?? "Creator"}
            </span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            {assignee ? (
              <>
                <Avatar className="h-6 w-6 border border-border/60">
                  {assignee.profile?.avatar_url ? (
                    <AvatarImage src={assignee.profile.avatar_url} alt="" />
                  ) : null}
                  <AvatarFallback className="bg-muted text-[9px]">
                    {getInitials(assignee.profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">
                  {assignee.profile?.full_name?.split(/\s+/)[0] ?? "Assignee"}
                </span>
              </>
            ) : (
              <span>Unassigned</span>
            )}
          </span>
        </div>
      </CardContent>
      <TaskFormDialog
        workspaceId={workspaceId}
        task={task}
        members={members}
        open={editOpen}
        onOpenChange={setEditOpen}
        onOptimisticUpsert={onOptimisticUpsert}
        onLocalMutation={onLocalMutation}
        onTaskCommitted={onTaskCommitted}
      />
    </Card>
  );
}

export function CreateTaskButton({
  workspaceId,
  members = [],
  onOptimisticUpsert,
  onLocalMutation,
  onTaskCommitted,
}: {
  workspaceId: string;
  members?: TaskBoardMember[];
} & TaskMutationHandlers) {
  return (
    <TaskFormDialog
      workspaceId={workspaceId}
      members={members}
      onOptimisticUpsert={onOptimisticUpsert}
      onLocalMutation={onLocalMutation}
      onTaskCommitted={onTaskCommitted}
      trigger={
        <Button>
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      }
    />
  );
}

export function TaskList({
  tasks,
  workspaceId,
  members = [],
  currentUserId = null,
  onOptimisticUpsert,
  onOptimisticRemove,
  onLocalMutation,
  onTaskCommitted,
  onTaskDeleted,
}: {
  tasks: Task[];
  workspaceId: string;
  members?: TaskBoardMember[];
  currentUserId?: string | null;
} & TaskMutationHandlers) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
        <h3 className="font-display text-base font-semibold">No tasks yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Add your first task to get this workspace moving.
        </p>
        <div className="mt-5 flex justify-center">
          <CreateTaskButton
            workspaceId={workspaceId}
            members={members}
            onOptimisticUpsert={onOptimisticUpsert}
            onLocalMutation={onLocalMutation}
            onTaskCommitted={onTaskCommitted}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tasks.map((task, index) => (
        <div
          key={task.id}
          className="animate-stagger-in"
          style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
        >
          <TaskCard
            task={task}
            workspaceId={workspaceId}
            members={members}
            currentUserId={currentUserId}
            onOptimisticUpsert={onOptimisticUpsert}
            onOptimisticRemove={onOptimisticRemove}
            onLocalMutation={onLocalMutation}
            onTaskCommitted={onTaskCommitted}
            onTaskDeleted={onTaskDeleted}
          />
        </div>
      ))}
    </div>
  );
}
