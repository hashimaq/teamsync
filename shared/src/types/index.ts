export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "in_progress" | "done";
export type WorkspaceRole = "owner" | "admin" | "member";
export type InvitationStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email?: string | null;
  created_at?: string;
}

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface WorkspaceWithMeta extends Workspace {
  task_count?: number;
  member_count?: number;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
}

export interface WorkspaceMemberWithProfile extends WorkspaceMember {
  profile: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
  } | null;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  inviter_id: string;
  invitee_id: string;
  invitee_email: string;
  status: InvitationStatus;
  created_at: string;
  responded_at: string | null;
}

export interface WorkspaceInvitationWithDetails extends WorkspaceInvitation {
  workspace: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  inviter: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
  } | null;
}

export interface Task {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  created_by: string;
  assignee_id?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  workspace_id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

export interface ChatMessageWithSender extends ChatMessage {
  sender: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  pending?: boolean;
  failed?: boolean;
  client_id?: string;
}

export type NotificationType =
  | "invitation_received"
  | "invitation_accepted"
  | "member_joined"
  | "task_assigned"
  | "task_completed"
  | "task_updated"
  | "task_deleted"
  | "role_changed"
  | "member_removed"
  | "workspace_renamed"
  | "welcome"
  | "chat_mention";

export interface Notification {
  id: string;
  workspace_id: string | null;
  recipient_id: string;
  sender_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  sender?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface WorkspaceActivityItem {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  event_type: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
