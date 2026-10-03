import React, { useState } from "react";

interface SessionSurfaceProps {
  onStartSession: (token: string) => void;
}

export const SessionSurface: React.FC<SessionSurfaceProps> = ({ onStartSession }) => {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = token.trim();
    if (!cleanToken) {
      setError("يرجى إدخال رمز الجلسة للمتابعة.");
      return;
    }
    setError(null);
    onStartSession(cleanToken);
  };

  return (
    <div className="ho-auth-screen" dir="rtl">
      <div className="ho-auth-card">
        <div className="ho-auth-header">
          <div className="ho-auth-brand-badge" aria-hidden="true">HO</div>
          <h1 className="ho-auth-title">HO Network</h1>
          <p className="ho-auth-subtitle">نظام الإدارة والتشغيل المؤسسي</p>
        </div>

        <form onSubmit={handleSubmit} className="ho-auth-form">
          <div className="ho-form-field">
            <label htmlFor="token-input" className="ho-label">
              رمز الجلسة المؤقت (Bearer Token)
            </label>
            <input
              id="token-input"
              type="password"
              className="ho-input ho-input-ltr"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ey..."
              autoComplete="off"
              dir="ltr"
              required
            />
          </div>

          {error && (
            <div className="ho-alert ho-alert-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="ho-btn ho-btn-primary ho-btn-block">
            بدء الجلسة
          </button>

          <div className="ho-auth-security-notice">
            <span className="ho-notice-icon" aria-hidden="true">🛡️</span>
            <div className="ho-notice-text">
              <strong>حماية الجلسة:</strong> يُحفظ الرمز في الذاكرة الحية فقط طوال مدة تبويب المتصفح، ولا يُخزن في التخزين المحلي (LocalStorage) أو ملفات تعريف الارتباط.
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
