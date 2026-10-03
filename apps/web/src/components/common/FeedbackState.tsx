import React from "react";

export type FeedbackMode = "loading" | "empty" | "error" | "session-expired" | "permission-denied";

interface FeedbackStateProps {
  mode: FeedbackMode;
  title?: string;
  message?: string;
  onRetry?: () => void;
  onAction?: () => void;
  actionLabel?: string;
  className?: string;
}

export const FeedbackState: React.FC<FeedbackStateProps> = ({
  mode,
  title,
  message,
  onRetry,
  onAction,
  actionLabel,
  className = "",
}) => {
  if (mode === "loading") {
    return (
      <div className={`ho-feedback ho-feedback-loading ${className}`} role="status" aria-live="polite">
        <div className="ho-spinner" aria-hidden="true" />
        <p className="ho-feedback-title">{title || "جارٍ تحميل البيانات..."}</p>
        {message && <p className="ho-feedback-msg">{message}</p>}
      </div>
    );
  }

  if (mode === "session-expired") {
    return (
      <div className={`ho-feedback ho-feedback-warning ${className}`} role="alert">
        <div className="ho-feedback-icon" aria-hidden="true">⏱️</div>
        <h3 className="ho-feedback-title">{title || "انتهت الجلسة المؤقتة"}</h3>
        <p className="ho-feedback-msg">{message || "تم مسح الرمز المؤقت من الذاكرة. يرجى إعادة تسجيل رمز الجلسة للمتابعة."}</p>
        {onAction && (
          <button type="button" className="ho-btn ho-btn-primary" onClick={onAction}>
            {actionLabel || "بدء جلسة جديدة"}
          </button>
        )}
      </div>
    );
  }

  if (mode === "permission-denied") {
    return (
      <div className={`ho-feedback ho-feedback-error ${className}`} role="alert">
        <div className="ho-feedback-icon" aria-hidden="true">🚫</div>
        <h3 className="ho-feedback-title">{title || "صلاحيات غير كافية"}</h3>
        <p className="ho-feedback-msg">{message || "لا تملك الصلاحية للوصول إلى هذا الإجراء أو السجل حسب إعدادات الـ API."}</p>
      </div>
    );
  }

  if (mode === "error") {
    return (
      <div className={`ho-feedback ho-feedback-error ${className}`} role="alert">
        <div className="ho-feedback-icon" aria-hidden="true">⚠️</div>
        <h3 className="ho-feedback-title">{title || "حدث خطأ أثناء الاتصال"}</h3>
        <p className="ho-feedback-msg">{message || "تعذر إكمال العملية من الخادم."}</p>
        {onRetry && (
          <button type="button" className="ho-btn ho-btn-secondary" onClick={onRetry}>
            إعادة المحاولة
          </button>
        )}
      </div>
    );
  }

  // mode === "empty"
  return (
    <div className={`ho-feedback ho-feedback-empty ${className}`} role="status">
      <div className="ho-feedback-icon" aria-hidden="true">📂</div>
      <h3 className="ho-feedback-title">{title || "لا توجد سجلات"}</h3>
      <p className="ho-feedback-msg">{message || "لم يتم العثور على أي بيانات مطابقة."}</p>
      {onAction && actionLabel && (
        <button type="button" className="ho-btn ho-btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export const SkeletonRows: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="ho-skeleton-wrapper" aria-hidden="true">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="ho-skeleton-row" />
    ))}
  </div>
);
