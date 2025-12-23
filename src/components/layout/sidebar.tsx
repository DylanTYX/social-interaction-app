"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  LayoutDashboard,
  Users,
  BookOpen,
  BarChart3,
  Settings,
  Mic,
} from "lucide-react";

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Chat Practice",
    href: "/simulate/chat",
    icon: MessageSquare,
  },
  {
    name: "Voice Practice",
    href: "/simulate/voice",
    icon: Mic,
  },
  {
    name: "Personas",
    href: "/dashboard/personas",
    icon: Users,
  },
  {
    name: "Scenarios",
    href: "/dashboard/scenarios",
    icon: BookOpen,
  },
  {
    name: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col bg-white border-r">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-lg font-bold">ConvoTrainer</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-100 cursor-pointer">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold">
            JD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              John Doe
            </p>
            <p className="text-xs text-gray-500 truncate">john@example.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
