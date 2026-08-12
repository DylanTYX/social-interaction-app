"use client";

import { NO_RESPONSE_MESSAGE } from "@/lib/chat-contract";
import { useCallback, useState } from "react";

import { useAnswerTimer } from "@/hooks/use-answer-timer";
import { AnswerCountdown } from "@/components/chat/answer-countdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend?: (message: string) => void;
  disabled?: boolean;
  timeLimitSeconds?: number;
  timeoutFallbackMessage?: string;
}

export function ChatInput({
  onSend,
  disabled,
  timeLimitSeconds = 300,
  timeoutFallbackMessage = NO_RESPONSE_MESSAGE,
}: ChatInputProps) {
  const [message, setMessage] = useState("");

  const submitMessage = useCallback(() => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || !onSend || disabled) {
      return false;
    }

    onSend(trimmedMessage);
    return true;
  }, [disabled, message, onSend]);

  const { deadlineMs } = useAnswerTimer({
    timeLimitSeconds,
    disabled,
    // Closes over the live draft. `useAnswerTimer` keeps this in a ref, so a
    // new identity per keystroke does not re-arm the countdown.
    onExpire: () => {
      if (disabled || !onSend) return false;

      const messageToSend = message.trim() || timeoutFallbackMessage;
      if (!messageToSend.trim()) return false;

      onSend(messageToSend);
      setMessage("");
      return true;
    },
  });

  const handleSend = () => {
    submitMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMessageChange = (nextMessage: string) => {
    setMessage(nextMessage);
  };

  return (
    <div className="space-y-2">
      <AnswerCountdown
        deadlineMs={deadlineMs}
        timeLimitSeconds={timeLimitSeconds}
        paused={disabled}
      />
      <div className="flex gap-3 items-end">
        {/* A placeholder is not a label: it disappears on focus and screen
            readers do not reliably announce it. This is the field the entire
            product is built around. */}
        <Textarea
          value={message}
          onChange={(e) => handleMessageChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Press Enter to send)"
          disabled={disabled}
          aria-label="Your answer"
          className="min-h-[60px] max-h-32 resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          rows={2}
        />
        <Button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          size="icon"
          aria-label="Send answer"
          className="h-[60px] w-[60px] shrink-0 shadow-soft-md hover:shadow-soft-lg transition-all duration-200"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
