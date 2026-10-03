import React from "react";

interface TopBarProps {
  onToggleSidebar: () => void;
  onEndSession: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onToggleSidebar, onEndSession }) => {
  return (
    <header className="ho-topbar">
      <div className="ho-topbar-start">
        <button
          type="button"
          className="ho-hamburger-btn"
          onClick={onToggleSidebar}
          aria-label="تبديل القائمة الجانبية"
        >
          <span className="ho-hamburger-line" />
          <span className="ho-hamburger-line" />
          <span className="ho-hamburger-line" />
        </button>

        <div className="ho-brand">
          <span className="ho-brand-badge" aria-hidden="true">HO</span>
          <div className="ho-brand-text">
            <span className="ho-brand-title">HO Network</span>
            <span className="ho-brand-subtitle">نظام التشغيل والإدارة</span>
          </div>
        </div>
      </div>

      <div className="ho-topbar-end">
        <div className="ho-session-indicator" title="الرمز المؤقت محفوظ في الذاكرة الحية فقط">
          <span className="ho-indicator-dot" aria-hidden="true" />
          <span className="ho-indicator-text">جلسة نشطة (ذاكرة مؤقتة)</span>
        </div>

        <button
          type="button"
          className="ho-btn ho-btn-outline ho-btn-sm"
          onClick={onEndSession}
          aria-label="إنهاء الجلسة ومسح الرمز"
        >
          إنهاء الجلسة
        </button>
      </div>
    </header>
  );
};
