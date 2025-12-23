"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/search-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavbarProps {
  title?: string;
}

export function Navbar({ title }: NavbarProps) {
  return (
    <div className="h-16 border-b border-gray-200/60 bg-white/90 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-10 shadow-soft">
      <div>
        {title && (
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Search - Reusable command surface with functional shortcut */}
        <SearchInput
          placeholder="Search..."
          showShortcut
          containerClassName="hidden md:block w-72"
        />

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 rounded-xl hover:bg-gray-100 transition-colors-smooth"
            >
              <Bell className="h-4 w-4 text-gray-600" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium text-sm">
                New practice session available
              </span>
              <span className="text-xs text-gray-500">
                Try the new Business Meeting scenario
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium text-sm">
                Weekly progress report
              </span>
              <span className="text-xs text-gray-500">
                You&apos;ve improved 15% this week!
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-center justify-center text-sm text-blue-600 font-medium">
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-9 gap-2 px-2 rounded-xl hover:bg-gray-100 transition-colors-smooth"
            >
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold shadow-lg shadow-purple-500/20">
                JD
              </div>
              <span className="text-sm font-medium text-gray-700 hidden sm:inline">
                John
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>John Doe</span>
                <span className="text-xs font-normal text-gray-500">
                  john@example.com
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Billing</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
