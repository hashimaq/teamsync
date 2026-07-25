import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  REALTIME_CHANNELS,
  firstName,
  truncate,
  type Notification,
  type Task,
} from "@teamsync/shared";
import { getSupabase, getSession } from "@/lib/supabase";
import {
  applyBadge,
  getActiveWorkspaceId,
  incrementBadge,
} from "@/lib/storage";

let notificationsChannel: RealtimeChannel | null = null;
let messagesChannel: RealtimeChannel | null = null;
let tasksChannel: RealtimeChannel | null = null;
let currentUserId: string | null = null;

async function showChromeNotification(options: {
  id: string;
  title: string;
  message: string;
}): Promise<void> {
  await chrome.notifications.create(options.id, {
    type: "basic",
    iconUrl: "assets/icon-128.png",
    title: options.title,
    message: options.message,
    priority: 1,
  });
}

async function subscribeNotifications(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (notificationsChannel) {
    await supabase.removeChannel(notificationsChannel);
    notificationsChannel = null;
  }

  notificationsChannel = supabase
    .channel(REALTIME_CHANNELS.notifications(userId))
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${userId}`,
      },
      (payload) => {
        void (async () => {
          const row = payload.new as Notification | null;
          if (!row?.id) return;
          await incrementBadge("notifications", 1);
          await showChromeNotification({
            id: `notif-${row.id}`,
            title: row.title || "TeamSync",
            message: truncate(row.message || "New notification", 120),
          });
          await chrome.runtime.sendMessage({ type: "EXT_REFRESH" }).catch(() => undefined);
        })();
      }
    )
    .subscribe();
}

async function subscribeMessages(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (messagesChannel) {
    await supabase.removeChannel(messagesChannel);
    messagesChannel = null;
  }

  messagesChannel = supabase
    .channel(REALTIME_CHANNELS.messages(userId))
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
      },
      (payload) => {
        void (async () => {
          const row = payload.new as {
            id?: string;
            sender_id?: string;
            message?: string;
            workspace_id?: string;
          } | null;
          if (!row?.id || !row.sender_id) return;
          if (row.sender_id === userId) return;

          await incrementBadge("messages", 1);

          let senderName = "Someone";
          const { data } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", row.sender_id)
            .maybeSingle();
          if (data?.full_name) senderName = firstName(data.full_name as string);

          await showChromeNotification({
            id: `msg-${row.id}`,
            title: "New Message",
            message: `${senderName}: ${truncate(row.message ?? "", 100)}`,
          });
          await chrome.runtime.sendMessage({ type: "EXT_REFRESH" }).catch(() => undefined);
        })();
      }
    )
    .subscribe();
}

async function subscribeTasks(workspaceId: string): Promise<void> {
  const supabase = getSupabase();
  if (tasksChannel) {
    await supabase.removeChannel(tasksChannel);
    tasksChannel = null;
  }

  tasksChannel = supabase
    .channel(REALTIME_CHANNELS.tasks(workspaceId))
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "tasks",
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => {
        void (async () => {
          const row = payload.new as Task | null;
          if (payload.eventType === "INSERT" && row?.assignee_id === currentUserId) {
            await showChromeNotification({
              id: `task-${row.id}`,
              title: "New task assigned",
              message: truncate(row.title, 100),
            });
          }
          await chrome.runtime.sendMessage({ type: "EXT_REFRESH" }).catch(() => undefined);
        })();
      }
    )
    .subscribe();
}

export async function startRealtime(): Promise<void> {
  const session = await getSession();
  if (!session?.user?.id) {
    currentUserId = null;
    await applyBadge({ messages: 0, notifications: 0 });
    return;
  }

  currentUserId = session.user.id;
  await applyBadge();
  await subscribeNotifications(session.user.id);
  await subscribeMessages(session.user.id);

  const workspaceId = await getActiveWorkspaceId();
  if (workspaceId) {
    await subscribeTasks(workspaceId);
  }
}

export async function stopRealtime(): Promise<void> {
  const supabase = getSupabase();
  if (notificationsChannel) {
    await supabase.removeChannel(notificationsChannel);
    notificationsChannel = null;
  }
  if (messagesChannel) {
    await supabase.removeChannel(messagesChannel);
    messagesChannel = null;
  }
  if (tasksChannel) {
    await supabase.removeChannel(tasksChannel);
    tasksChannel = null;
  }
}

export async function refreshTaskSubscription(): Promise<void> {
  const workspaceId = await getActiveWorkspaceId();
  if (workspaceId && currentUserId) {
    await subscribeTasks(workspaceId);
  }
}

// Keep the service worker alive for realtime sockets
chrome.alarms.create("teamsync-keepalive", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "teamsync-keepalive") {
    void startRealtime();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  void startRealtime();
});

chrome.runtime.onStartup.addListener(() => {
  void startRealtime();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "EXT_START_REALTIME") {
    void startRealtime().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "EXT_STOP_REALTIME") {
    void stopRealtime().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "EXT_WORKSPACE_CHANGED") {
    void refreshTaskSubscription().then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

void startRealtime();
