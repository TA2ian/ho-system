import React, { useState, useEffect, useRef, useId, useCallback } from "react";
import type { ApiClient } from "../../api/client";

export interface Customer {
  id: string;
  type: "individual" | "business";
  displayName: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: "active" | "inactive" | "blocked" | string;
  createdAt?: string;
  updatedAt?: string;
}

interface CreateCustomerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdCustomer: Customer) => void;
  api: ApiClient;
}

export const CreateCustomerDialog: React.FC<CreateCustomerDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  api,
}) => {
  const [displayName, setDisplayName] = useState("");
  const [type, setType] = useState<"individual" | "business">("individual");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  // Accessible unique IDs
  const autoId = useId();
  const titleId = `ho-cust-title-${autoId}`;
  const descId = `ho-cust-desc-${autoId}`;
  const nameId = `ho-cust-name-${autoId}`;
  const nameErrorId = `ho-cust-name-err-${autoId}`;
  const typeId = `ho-cust-type-${autoId}`;
  const phoneId = `ho-cust-phone-${autoId}`;
  const emailId = `ho-cust-email-${autoId}`;
  const emailErrorId = `ho-cust-email-err-${autoId}`;
  const notesId = `ho-cust-notes-${autoId}`;
  const apiErrorId = `ho-cust-api-err-${autoId}`;

  // Reset and focus management
  useEffect(() => {
    if (isOpen) {
      triggerElementRef.current = document.activeElement as HTMLElement | null;
      setDisplayName("");
      setType("individual");
      setPhone("");
      setEmail("");
      setNotes("");
      setApiError(null);
      setTouched({});

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const timer = setTimeout(() => {
        firstInputRef.current?.focus();
      }, 40);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = originalOverflow;
        if (triggerElementRef.current && typeof triggerElementRef.current.focus === "function") {
          triggerElementRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  // Validation rules
  const trimmedName = displayName.trim();
  const isNameValid = trimmedName.length >= 2 && trimmedName.length <= 200;
  const isEmailValid = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isFormValid = isNameValid && isEmailValid;

  // Keyboard navigation & focus trap
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        if (!isSubmitting) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
        return;
      }

      if (e.key === "Tab") {
        if (!dialogRef.current) return;

        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [isSubmitting, onClose]
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true });

    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setApiError(null);

    try {
      // POST contract compliant with server-side schema & idempotency
      const payload = {
        type,
        displayName: trimmedName,
        phone: phone.trim() ? phone.trim() : null,
        email: email.trim() ? email.trim().toLowerCase() : null,
        notes: notes.trim() ? notes.trim() : null,
      };

      // Idempotency key >= 16 characters
      const idempotencyKey = crypto.randomUUID();
      const created = await api.post<Customer>("customers", payload, idempotencyKey);

      onSuccess(created);
      onClose();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "تعذر إنشاء العميل عبر واجهة الـ API.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="ho-dialog-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="ho-dialog ho-dialog-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={handleKeyDown}
      >
        <form onSubmit={handleSubmit} noValidate>
          <div className="ho-dialog-header">
            <div>
              <h2 id={titleId} className="ho-dialog-title">
                إضافة عميل جديد
              </h2>
              <p id={descId} className="ho-dialog-description">
                إنشاء حساب عميل جديد مع حفظ الهوية والبيانات التعريفية.
              </p>
            </div>
            <button
              type="button"
              className="ho-dialog-close-btn"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="إغلاق النافذة"
            >
              ✕
            </button>
          </div>

          <div className="ho-dialog-body">
            {apiError && (
              <div
                id={apiErrorId}
                className="ho-alert ho-alert-danger"
                role="alert"
                aria-live="assertive"
                style={{ marginBottom: "1rem" }}
              >
                <span className="ho-alert-icon">⚠️</span>
                <div className="ho-alert-content">
                  <strong>خطأ في الإنشاء:</strong> {apiError}
                </div>
              </div>
            )}

            <div className="ho-form-grid">
              {/* Type selection */}
              <div className="ho-form-field">
                <label htmlFor={typeId} className="ho-label">
                  تصنيف العميل <span className="ho-required-marker">*</span>
                </label>
                <select
                  id={typeId}
                  className="ho-select"
                  value={type}
                  onChange={(e) => setType(e.target.value as "individual" | "business")}
                  disabled={isSubmitting}
                >
                  <option value="individual">عميل فرد (شخصي)</option>
                  <option value="business">منشأة أو شركة تجارية</option>
                </select>
              </div>

              {/* Display Name */}
              <div className="ho-form-field">
                <label htmlFor={nameId} className="ho-label">
                  الاسم الكامل أو اسم المنشأة <span className="ho-required-marker">*</span>
                </label>
                <input
                  id={nameId}
                  ref={firstInputRef}
                  type="text"
                  className={`ho-input ${touched.name && !isNameValid ? "ho-input-error" : ""}`}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                  placeholder={type === "business" ? "مثال: شركة الأمل للمقاولات" : "مثال: محمد الأحمد"}
                  maxLength={200}
                  disabled={isSubmitting}
                  aria-required="true"
                  aria-invalid={touched.name && !isNameValid}
                  aria-describedby={touched.name && !isNameValid ? nameErrorId : undefined}
                  required
                />
                {touched.name && !isNameValid && (
                  <span id={nameErrorId} className="ho-field-error" role="alert">
                    اسم العميل إلزامي ويجب ألا يقل عن حرفين ولا يزيد عن 200 حرف.
                  </span>
                )}
              </div>

              {/* Phone */}
              <div className="ho-form-field">
                <label htmlFor={phoneId} className="ho-label">
                  رقم الهاتف <span className="ho-optional-marker">(اختياري)</span>
                </label>
                <input
                  id={phoneId}
                  type="tel"
                  dir="ltr"
                  className="ho-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+963-9XXXXXXXX"
                  maxLength={50}
                  disabled={isSubmitting}
                />
              </div>

              {/* Email */}
              <div className="ho-form-field">
                <label htmlFor={emailId} className="ho-label">
                  البريد الإلكتروني <span className="ho-optional-marker">(اختياري)</span>
                </label>
                <input
                  id={emailId}
                  type="email"
                  dir="ltr"
                  className={`ho-input ${touched.email && !isEmailValid ? "ho-input-error" : ""}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                  placeholder="client@example.com"
                  maxLength={320}
                  disabled={isSubmitting}
                  aria-invalid={touched.email && !isEmailValid}
                  aria-describedby={touched.email && !isEmailValid ? emailErrorId : undefined}
                />
                {touched.email && !isEmailValid && (
                  <span id={emailErrorId} className="ho-field-error" role="alert">
                    صيغة البريد الإلكتروني غير صحيحة.
                  </span>
                )}
              </div>

              {/* Notes */}
              <div className="ho-form-field ho-form-field-full">
                <label htmlFor={notesId} className="ho-label">
                  ملاحظات إضافية <span className="ho-optional-marker">(اختياري)</span>
                </label>
                <textarea
                  id={notesId}
                  className="ho-textarea"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي معلومات تشغيلية أو عنوان أو تفاصيل تخص العميل..."
                  maxLength={2000}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <div className="ho-dialog-footer">
            <button
              type="button"
              className="ho-btn ho-btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="ho-btn ho-btn-primary"
              disabled={!isFormValid || isSubmitting}
            >
              {isSubmitting ? "جارٍ الإنشاء..." : "حفظ وإنشاء العميل"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
