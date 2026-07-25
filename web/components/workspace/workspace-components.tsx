"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createWorkspace,
  deleteWorkspace,
  updateWorkspace,
} from "@/actions/workspaces";
import { workspaceSchema, type WorkspaceInput } from "@/lib/validations";
import type { Workspace, WorkspaceWithMeta } from "@/types";
import { cn } from "@/utils";
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

interface WorkspaceFormDialogProps {
  workspace?: Workspace;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function WorkspaceFormDialog({
  workspace,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: WorkspaceFormDialogProps) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WorkspaceInput>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: {
      name: workspace?.name ?? "",
      description: workspace?.description ?? "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    const formData = new FormData();
    formData.set("name", values.name);
    formData.set("description", values.description ?? "");

    startTransition(async () => {
      const result = workspace
        ? await updateWorkspace(workspace.id, formData)
        : await createWorkspace(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      reset(
        workspace
          ? { name: result.data.name, description: result.data.description ?? "" }
          : { name: "", description: "" }
      );
      setOpen(false);
      router.refresh();
      if (!workspace) {
        router.push(`/workspace/${result.data.id}`);
      }
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{workspace ? "Edit workspace" : "Create workspace"}</DialogTitle>
          <DialogDescription>
            {workspace
              ? "Update the name and description for this workspace."
              : "Give your team a space to organize tasks together."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Product Launch" {...register("name")} />
            {errors.name ? (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What is this workspace for?"
              {...register("description")}
            />
            {errors.description ? (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            ) : null}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? workspace
                  ? "Saving..."
                  : "Creating..."
                : workspace
                  ? "Save changes"
                  : "Create workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface WorkspaceCardProps {
  workspace: WorkspaceWithMeta;
  canManage?: boolean;
}

export function WorkspaceCard({ workspace, canManage = true }: WorkspaceCardProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const [isOpening, startOpen] = useTransition();

  function openWorkspace() {
    startOpen(() => {
      router.push(`/workspace/${workspace.id}`);
    });
  }

  return (
    <Card
      role="link"
      tabIndex={0}
      aria-label={`Open ${workspace.name} tasks`}
      onClick={openWorkspace}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openWorkspace();
        }
      }}
      className={cn(
        "group cursor-pointer border-border/80 transition-all duration-300",
        "hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg hover:shadow-blue-500/10",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isOpening && "animate-card-press border-primary/40 shadow-lg shadow-blue-500/15"
      )}
    >
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
            <FolderKanban className="h-5 w-5" />
          </div>
          {canManage ? (
            <div
              className="flex gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Edit workspace"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Delete workspace"
                disabled={isDeleting}
                onClick={() => {
                  if (!confirm("Delete this workspace and all of its tasks?")) return;
                  startDelete(async () => {
                    await deleteWorkspace(workspace.id);
                    router.refresh();
                  });
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ) : null}
        </div>
        <div>
          <CardTitle className="font-display text-xl transition-colors group-hover:text-primary">
            {workspace.name}
          </CardTitle>
          <CardDescription className="mt-2 line-clamp-2">
            {workspace.description || "No description yet"}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {workspace.task_count ?? 0} tasks · {workspace.member_count ?? 0} members
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-primary transition-all duration-300 group-hover:gap-1.5">
          {isOpening ? "Opening..." : "Open tasks"}
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </span>
      </CardContent>
      <WorkspaceFormDialog
        workspace={workspace}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </Card>
  );
}

export function CreateWorkspaceButton() {
  return (
    <WorkspaceFormDialog
      trigger={
        <Button>
          <Plus className="h-4 w-4" />
          Create Workspace
        </Button>
      }
    />
  );
}

export function WorkspaceGrid({ workspaces }: { workspaces: WorkspaceWithMeta[] }) {
  if (workspaces.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border px-6 py-16 text-center">
        <FolderKanban className="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 className="mt-4 font-display text-xl font-semibold">No workspaces yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your first workspace to start organizing tasks.
        </p>
        <div className="mt-6 flex justify-center">
          <CreateWorkspaceButton />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {workspaces.map((workspace) => (
        <WorkspaceCard key={workspace.id} workspace={workspace} />
      ))}
    </div>
  );
}
