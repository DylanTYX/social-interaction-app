import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "ai";
  content: string;
  timestamp?: string;
  personaName?: string;
}

export function ChatMessage({
  role,
  content,
  timestamp,
  personaName = "AI Assistant",
}: ChatMessageProps) {
  const isUser = role === "user";

  // Extract initials from persona name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = isUser ? "You" : personaName;
  const initials = isUser ? "You" : getInitials(personaName);

  return (
    <div className={cn("flex gap-3 items-start", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold",
          isUser ? "bg-blue-600 text-white" : "bg-purple-100 text-purple-700"
        )}
      >
        {initials}
      </div>

      {/* Message Content */}
      <div className={cn("flex flex-col max-w-[75%]", isUser && "items-end")}>
        <div className="flex items-baseline gap-2 mb-1">
          <span
            className={cn(
              "text-xs font-medium",
              isUser ? "text-blue-700" : "text-gray-700"
            )}
          >
            {displayName}
          </span>
          {timestamp && (
            <span className="text-[10px] text-gray-400">{timestamp}</span>
          )}
        </div>

        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 shadow-sm",
            isUser
              ? "bg-blue-600 text-white rounded-tr-sm"
              : "bg-white text-gray-900 border border-gray-200 rounded-tl-sm"
          )}
        >
          <p className="text-sm leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  );
}
