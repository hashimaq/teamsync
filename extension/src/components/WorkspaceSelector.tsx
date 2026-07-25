import type { WorkspaceWithMeta } from "@teamsync/shared";

export function WorkspaceSelector({
  workspaces,
  workspaceId,
  onChange,
  disabled,
}: {
  workspaces: WorkspaceWithMeta[];
  workspaceId: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  if (workspaces.length === 0) {
    return (
      <p className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400">
        No workspaces yet — create one on the web app.
      </p>
    );
  }

  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
        Workspace
      </span>
      <select
        disabled={disabled}
        value={workspaceId ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
    </label>
  );
}
