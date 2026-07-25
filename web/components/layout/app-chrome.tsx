"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { ChatToastProvider } from "@/components/chat/chat-toast-provider";
import { NotificationProvider } from "@/components/notifications/notification-provider";

interface AppChromeProps {
  userName?: string | null;
  userId?: string | null;
  children: ReactNode;
}

function ChromeShell({
  userName,
  userId,
  children,
}: {
  userName?: string | null;
  userId?: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isWorkspaceRoute = pathname.startsWith("/workspace/");

  if (isWorkspaceRoute) {
    return (
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
        <NavigationProgress />
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <NavigationProgress />
      <Sidebar userName={userName} userId={userId} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 px-4 pb-10 pt-20 lg:px-8 lg:pt-8">{children}</main>
      </div>
    </div>
  );
}

export function AppChrome({ userName, userId = null, children }: AppChromeProps) {
  return (
    <NotificationProvider userId={userId}>
      <Suspense
        fallback={
          <ChromeShell userName={userName} userId={userId}>
            {children}
          </ChromeShell>
        }
      >
        <ChatToastProvider userId={userId}>
          <ChromeShell userName={userName} userId={userId}>
            {children}
          </ChromeShell>
        </ChatToastProvider>
      </Suspense>
    </NotificationProvider>
  );
}
