import React, { useEffect } from "react";

export interface NavItem {
  id: string;
  label: string;
  category: "operations" | "financials" | "foundation";
  status?: "implemented" | "foundation-only";
}

interface SidebarProps {
  id: string;
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  id,
  items,
  activeId,
  onSelect,
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const operations = items.filter((i) => i.category === "operations");
  const financials = items.filter((i) => i.category === "financials");
  const foundational = items.filter((i) => i.category === "foundation");

  const renderGroup = (title: string, groupItems: NavItem[]) => (
    <div className="ho-nav-group">
      <div className="ho-nav-group-title">{title}</div>
      <ul className="ho-nav-list" role="list">
        {groupItems.map((item) => {
          const isActive = activeId === item.id;
          const isFoundationOnly = item.status === "foundation-only";
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`ho-nav-item ${isActive ? "is-active" : ""} ${isFoundationOnly ? "is-foundation-only" : ""}`}
                onClick={() => {
                  onSelect(item.id);
                  onClose();
                }}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="ho-nav-label">{item.label}</span>
                {isFoundationOnly && (
                  <span className="ho-nav-tag" title="عقود الـAPI متوفرة، والواجهة التشغيلية قيد التأسيس">
                    قيد التأسيس
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <>
      <button
        type="button"
        className={`ho-sidebar-overlay ${isOpen ? "is-visible" : ""}`}
        onClick={onClose}
        aria-label="إغلاق القائمة الجانبية"
      />
      <aside
        id={id}
        className={`ho-sidebar ${isOpen ? "is-open" : ""}`}
        aria-label="التنقل الرئيسي"
      >
        <nav className="ho-sidebar-nav">
          {renderGroup("العمليات وسجل العملاء", operations)}
          {renderGroup("المالية والتحصيل", financials)}
          {renderGroup("وحدات التأسيس التشغيلي", foundational)}
        </nav>
        <div className="ho-sidebar-footer">
          <small className="ho-system-version">HO Foundation v1 — RTL Operations</small>
        </div>
      </aside>
    </>
  );
};
