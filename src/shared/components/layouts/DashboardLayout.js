"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "../Sidebar";
import Header from "../Header";

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Desktop */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Sidebar - Mobile */}
      <div
        className={`fixed inset-y-0 start-0 z-50 transform lg:hidden transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <main className="flex flex-col flex-1 h-full min-w-0 relative transition-colors duration-300 isolate bg-bg">
        <Header key={pathname} onMenuClick={() => setSidebarOpen(true)} />
        {(() => {
          const isFullHeightChat = pathname === "/dashboard/nova-bot";
          return (
            <div className={`flex-1 overflow-y-auto custom-scrollbar ${isFullHeightChat ? "" : "p-6 lg:p-10"} ${isFullHeightChat ? "flex flex-col overflow-hidden" : ""}`}>
              <div className={`${isFullHeightChat ? "flex-1 w-full h-full flex flex-col" : "max-w-7xl mx-auto"}`}>{children}</div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
