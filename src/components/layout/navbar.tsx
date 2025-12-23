import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  title?: string;
}

export function Navbar({ title }: NavbarProps) {
  return (
    <div className="h-16 border-b bg-white flex items-center justify-between px-6">
      <div>
        {title && <h1 className="text-2xl font-bold text-gray-900">{title}</h1>}
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-64 pl-10 h-10"
          />
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
        </Button>
      </div>
    </div>
  );
}
