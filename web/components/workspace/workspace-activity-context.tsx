"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type WorkspaceActivityItem = {
  id: string;
  message: string;
  createdAt: string;
};

interface WorkspaceActivityContextValue {
  activity: WorkspaceActivityItem[];
  pushActivity: (item: Omit<WorkspaceActivityItem, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  }) => void;
}

const WorkspaceActivityContext =
  createContext<WorkspaceActivityContextValue | null>(null);

export function WorkspaceActivityProvider({ children }: { children: ReactNode }) {
  const [activity, setActivity] = useState<WorkspaceActivityItem[]>([]);

  const pushActivity = useCallback(
    (
      item: Omit<WorkspaceActivityItem, "id" | "createdAt"> & {
        id?: string;
        createdAt?: string;
      }
    ) => {
      const entry: WorkspaceActivityItem = {
        id: item.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        message: item.message,
        createdAt: item.createdAt ?? new Date().toISOString(),
      };
      setActivity((current) => {
        // Avoid duplicate keys when sync/effects fire twice (e.g. Strict Mode).
        if (current.some((existing) => existing.id === entry.id)) {
          return current;
        }
        return [entry, ...current].slice(0, 30);
      });
    },
    []
  );

  const value = useMemo(
    () => ({ activity, pushActivity }),
    [activity, pushActivity]
  );

  return (
    <WorkspaceActivityContext.Provider value={value}>
      {children}
    </WorkspaceActivityContext.Provider>
  );
}

export function useWorkspaceActivity() {
  const context = useContext(WorkspaceActivityContext);
  if (!context) {
    throw new Error(
      "useWorkspaceActivity must be used within WorkspaceActivityProvider"
    );
  }
  return context;
}

/** Safe optional access when provider may be absent. */
export function useWorkspaceActivityOptional() {
  return useContext(WorkspaceActivityContext);
}
