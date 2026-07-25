"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type WorkspacePanel =
  | "chat"
  | "tasks"
  | "whiteboard"
  | "members"
  | "settings"
  | "notifications";

const PANEL_VALUES: WorkspacePanel[] = [
  "chat",
  "tasks",
  "whiteboard",
  "members",
  "settings",
  "notifications",
];

function parsePanel(value: string | null | undefined): WorkspacePanel | null {
  if (!value) return null;
  return PANEL_VALUES.includes(value as WorkspacePanel)
    ? (value as WorkspacePanel)
    : null;
}

interface WorkspaceShellContextValue {
  panel: WorkspacePanel;
  setPanel: (panel: WorkspacePanel) => void;
}

const WorkspaceShellContext = createContext<WorkspaceShellContextValue | null>(
  null
);

export function WorkspaceShellProvider({
  children,
  defaultPanel = "chat",
}: {
  children: ReactNode;
  defaultPanel?: WorkspacePanel;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const panelFromUrl =
    parsePanel(searchParams.get("panel")) ?? defaultPanel;

  const [panel, setPanelState] = useState<WorkspacePanel>(panelFromUrl);

  useEffect(() => {
    setPanelState(panelFromUrl);
  }, [panelFromUrl]);

  const setPanel = useCallback(
    (next: WorkspacePanel) => {
      setPanelState(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "chat") {
        params.delete("panel");
      } else {
        params.set("panel", next);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const value = useMemo(() => ({ panel, setPanel }), [panel, setPanel]);

  return (
    <WorkspaceShellContext.Provider value={value}>
      {children}
    </WorkspaceShellContext.Provider>
  );
}

export function useWorkspaceShell() {
  const context = useContext(WorkspaceShellContext);
  if (!context) {
    throw new Error("useWorkspaceShell must be used within WorkspaceShellProvider");
  }
  return context;
}
