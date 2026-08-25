"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The row above every library list: find things on the left, add things on
 * the right.
 *
 * The three libraries had three answers to "where are this page's actions".
 * Job descriptions and resumes put find/filter in an ad-hoc row and their add
 * action in a card; personas put three management buttons in the page
 * header and had no row at all. Learn one, relearn the next. The rule now:
 *
 *   PageHeader        one workflow CTA ("Start an interview"), identical on all
 *   LibraryToolbar    [ search ...... ] [ filters ]     [ primary ] [ ... ]
 *   Card menu         per-item edit / duplicate / delete
 *
 * One asymmetry survives, on purpose: documents are added through a card
 * (pasting or uploading needs room), personas through a button in this row
 * (a form fits a dialog). The *position* of "add" differs; the row does not.
 */
export function LibraryToolbar({
  search,
  filters,
  actions,
  className,
}: {
  search?: {
    value: string;
    onChange: (next: string) => void;
    placeholder: string;
    ariaLabel: string;
  };
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {search && (
        <div className="relative min-w-50 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder}
            aria-label={search.ariaLabel}
            className="pl-9"
          />
        </div>
      )}
      {filters}
      {actions && (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
