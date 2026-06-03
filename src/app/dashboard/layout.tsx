import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { CommandPalette } from "@/components/layout/command-palette";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="h-screen flex bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">{children}</main>
        <MobileNav />
        <CommandPalette />
      </div>
    </SidebarProvider>
  );
}
