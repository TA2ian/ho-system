import React, { useState } from "react";
import { TopBar } from "./TopBar";
import { Sidebar, NavItem } from "./Sidebar";

interface AppShellProps {
  navItems: NavItem[];
  activeId: string;
  onSelectNav: (id: string) => void;
  onEndSession: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  navItems,
  activeId,
  onSelectNav,
  onEndSession,
  children,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeItem = navItems.find((i) => i.id === activeId);

  return (
    <div className="ho-app-shell" dir="rtl">
      <TopBar
        sidebarOpen={sidebarOpen}
        sidebarId="ho-main-navigation"
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        onEndSession={onEndSession}
      />

      <div className="ho-workspace">
        <Sidebar
          id="ho-main-navigation"
          items={navItems}
          activeId={activeId}
          onSelect={onSelectNav}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="ho-main-content">
          <header className="ho-page-header">
            <div className="ho-page-title-group">
              <span className="ho-page-category">
                {activeItem?.category === "operations"
                  ? "العمليات"
                  : activeItem?.category === "financials"
                  ? "المالية"
                  : "التأسيس"}
              </span>
              <h1 className="ho-page-title">{activeItem?.label || "HO Network"}</h1>
            </div>
            {activeItem?.status === "foundation-only" && (
              <span className="ho-badge ho-badge-placeholder">
                واجهة تشغيلية قيد الإعداد
              </span>
            )}
          </header>

          <div className="ho-page-body">{children}</div>
        </main>
      </div>
    </div>
  );
};
