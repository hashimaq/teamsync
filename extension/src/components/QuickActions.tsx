import {
  CheckSquare,
  ExternalLink,
  MessageSquare,
  PenTool,
} from "lucide-react";
import { Button } from "@/components/ui";

export function QuickActions({
  onOpenWeb,
  onOpenChat,
  onOpenWhiteboard,
  onOpenTasks,
  disabled,
}: {
  onOpenWeb: () => void;
  onOpenChat: () => void;
  onOpenWhiteboard: () => void;
  onOpenTasks: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" disabled={disabled} onClick={onOpenWeb} className="justify-start">
        <ExternalLink className="h-3.5 w-3.5" />
        Open Web
      </Button>
      <Button variant="outline" disabled={disabled} onClick={onOpenChat} className="justify-start">
        <MessageSquare className="h-3.5 w-3.5" />
        Chat
      </Button>
      <Button
        variant="outline"
        disabled={disabled}
        onClick={onOpenWhiteboard}
        className="justify-start"
      >
        <PenTool className="h-3.5 w-3.5" />
        Whiteboard
      </Button>
      <Button variant="outline" disabled={disabled} onClick={onOpenTasks} className="justify-start">
        <CheckSquare className="h-3.5 w-3.5" />
        Tasks
      </Button>
    </div>
  );
}
