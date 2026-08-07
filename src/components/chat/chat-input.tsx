"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend?: (message: string) => void;
  disabled?: boolean;
  timeLimitSeconds?: number;
  timeoutFallbackMessage?: string;
}

function formatRemainingTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder
    .toString()
    .padStart(2, "0")}`;
}

export function ChatInput({
  onSend,
  disabled,
  timeLimitSeconds = 300,
  timeoutFallbackMessage = "[No response submitted before time expired.]",
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [deadlineMs] = useState<number>(
    () => Date.now() + timeLimitSeconds * 1000,
  );
  const [clockMs, setClockMs] = useState(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAutoSubmittedRef = useRef(false);
  const messageRef = useRef("");
  const onSendRef = useRef(onSend);

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  useEffect(() => {
    onSendRef.current = onSend;
  }, [onSend]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const submitMessage = useCallback(() => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || !onSend || disabled) {
      return false;
    }

    onSend(trimmedMessage);
    return true;
  }, [disabled, message, onSend]);

  const autoSubmitCurrentMessage = useCallback(() => {
    if (disabled || !onSendRef.current) {
      return false;
    }

    const trimmedMessage = messageRef.current.trim();
    const messageToSend = trimmedMessage || timeoutFallbackMessage;

    if (!messageToSend.trim()) {
      return false;
    }

    hasAutoSubmittedRef.current = true;
    onSendRef.current(messageToSend);
    return true;
  }, [disabled, timeoutFallbackMessage]);

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

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  useEffect(() => {
    if (disabled) {
      clearTimer();
      return;
    }

    if (timerRef.current) {
      return;
    }

    timerRef.current = setInterval(() => {
      const now = Date.now();
      setClockMs(now);

      if (now < deadlineMs || hasAutoSubmittedRef.current) {
        return;
      }

      hasAutoSubmittedRef.current = true;
      const sent = autoSubmitCurrentMessage();
      if (!sent) {
        hasAutoSubmittedRef.current = false;
      }
    }, 250);

    return () => {
      clearTimer();
    };
  }, [autoSubmitCurrentMessage, clearTimer, deadlineMs, disabled]);

  const remainingSeconds = Math.max(
    0,
    Math.ceil((deadlineMs - clockMs) / 1000),
  );

  const showTimer = true;
  const timerText = formatRemainingTime(remainingSeconds);
  const timerWarning =
    remainingSeconds <= Math.min(60, timeLimitSeconds * 0.15);

  return (
    <div className="space-y-2">
      {showTimer && (
        <div
          className={`text-xs font-medium ${
            timerWarning ? "text-red-600" : "text-slate-500"
          }`}
        >
          Response timer: {timerText}
        </div>
      )}
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
