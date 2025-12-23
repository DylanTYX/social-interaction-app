"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Show the ⌘K keyboard shortcut hint */
  showShortcut?: boolean;
  /** Callback when the search value changes */
  onValueChange?: (value: string) => void;
  /** Container className */
  containerClassName?: string;
}

export function SearchInput({
  className,
  containerClassName,
  showShortcut = true,
  onValueChange,
  value,
  onChange,
  ...props
}: SearchInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [internalValue, setInternalValue] = React.useState("");
  const [isFocused, setIsFocused] = React.useState(false);
  const [isMac, setIsMac] = React.useState(false);

  // Detect platform after mount to avoid hydration mismatch
  React.useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
  }, []);

  // Support both controlled and uncontrolled usage
  const isControlled = value !== undefined;
  const currentValue = isControlled ? String(value) : internalValue;
  const hasValue = currentValue.length > 0;

  // Global keyboard shortcut (⌘K / Ctrl+K)
  React.useEffect(() => {
    if (!showShortcut) return;

    function handleKeyDown(e: KeyboardEvent) {
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showShortcut]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onChange?.(e);
    onValueChange?.(newValue);
  };

  const handleClear = () => {
    if (!isControlled) {
      setInternalValue("");
    }
    onValueChange?.("");
    inputRef.current?.focus();

    // Trigger a synthetic change event for controlled components
    if (inputRef.current) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      nativeInputValueSetter?.call(inputRef.current, "");
      const event = new Event("input", { bubbles: true });
      inputRef.current.dispatchEvent(event);
    }
  };

  // Determine if shortcut hint should be visible
  const showShortcutHint = showShortcut && !hasValue && !isFocused;

  return (
    <div className={cn("relative", containerClassName)}>
      {/* Search Icon */}
      <Search
        className={cn(
          "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors duration-150",
          isFocused ? "text-gray-600" : "text-gray-400"
        )}
        aria-hidden="true"
      />

      {/* Input */}
      <input
        ref={inputRef}
        type="search"
        value={currentValue}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={cn(
          // Base styles
          "flex h-9 w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm",
          // Padding for icons
          "pl-10",
          hasValue ? "pr-9" : showShortcut ? "pr-16" : "pr-3",
          // Border and ring
          "border-gray-200/80 ring-offset-background",
          "focus:bg-white focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-0",
          // Placeholder
          "placeholder:text-gray-400",
          // Transitions
          "transition-all duration-200",
          // Hide native clear button
          "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
          // Disabled
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        aria-label="Search"
        {...props}
      />

      {/* Right-side elements container */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
        {/* Clear button - shown when there's content */}
        {hasValue && (
          <button
            type="button"
            onClick={handleClear}
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-md",
              "text-gray-400 hover:text-gray-600 hover:bg-gray-200/50",
              "transition-colors duration-150",
              "focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-1"
            )}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Keyboard shortcut hint - hidden when focused or has value */}
        {showShortcutHint && (
          <div
            className={cn(
              "flex items-center gap-0.5 pointer-events-none",
              "transition-opacity duration-150",
              isFocused && "opacity-0"
            )}
            aria-hidden="true"
          >
            <kbd
              className={cn(
                "inline-flex h-5 min-w-5 items-center justify-center rounded",
                "bg-white border border-gray-200 px-1",
                "font-sans text-[10px] font-medium text-gray-400"
              )}
            >
              {isMac ? "⌘" : "Ctrl"}
            </kbd>
            <kbd
              className={cn(
                "inline-flex h-5 min-w-5 items-center justify-center rounded",
                "bg-white border border-gray-200 px-1",
                "font-sans text-[10px] font-medium text-gray-400"
              )}
            >
              K
            </kbd>
          </div>
        )}
      </div>
    </div>
  );
}
