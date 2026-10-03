import React, { useState, useEffect, useRef, useId, useCallback } from "react";

interface ReasonPromptDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  inputLabel?: string;
  placeholder?: string;
  minCharacters?: number;
  confirmLabel?: string;
  cancelLabel?: string;
  isProcessing?: boolean;
  isDestructive?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export const ReasonPromptDialog: React.FC<ReasonPromptDialogProps> = ({
  isOpen,
  title,
  description,
  inputLabel = "سبب العملية (إلزامي)",
  placeholder = "أدخل سبب إلغاء أو استرجاع المعاملة...",
  minCharacters = 3,
  confirmLabel = "تأكيد العملية",
  cancelLabel = "إلغاء",
  isProcessing = false,
  isDestructive = true,
  onConfirm,
  onCancel,
}) => {
  const [reason, setReason] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Generate unique IDs per instance to prevent DOM ID collisions
  const autoId = useId();
  const titleId = `ho-reason-title-${autoId}`;
  const descId = `ho-reason-desc-${autoId}`;
  const inputId = `ho-reason-input-${autoId}`;
  const hintId = `ho-reason-hint-${autoId}`;

  // Focus restoration & background scroll locking
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setReason("");

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 30);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = originalOverflow;
        if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  // Focus trap & Escape key handling
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        if (!isProcessing) {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
        return;
      }

      if (e.key === "Tab") {
        if (!dialogRef.current) return;

        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
    [isProcessing, onCancel]
  );

  if (!isOpen) return null;

  const isValid = reason.trim().length >= minCharacters;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid && !isProcessing) {
      onConfirm(reason.trim());
    }
  };

  return (
    <div
      className="ho-dialog-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="ho-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={`${descId} ${hintId}`}
        onKeyDown={handleKeyDown}
      >
        <form onSubmit={handleSubmit}>
          <div className="ho-dialog-header">
            <h2 id={titleId} className="ho-dialog-title">
              {title}
            </h2>
          </div>
          <div className="ho-dialog-body">
            <p id={descId} className="ho-dialog-description">
              {description}
            </p>
            <div className="ho-form-field">
              <label htmlFor={inputId} className="ho-label">
                {inputLabel}
              </label>
              <textarea
                id={inputId}
                ref={inputRef}
                className="ho-textarea"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={placeholder}
                disabled={isProcessing}
                aria-describedby={hintId}
                required
              />
              <small id={hintId} className="ho-field-hint">
                يجب ألا يقل السبب عن {minCharacters} أحرف.
              </small>
            </div>
          </div>
          <div className="ho-dialog-footer">
            <button
              type="button"
              className="ho-btn ho-btn-secondary"
              onClick={onCancel}
              disabled={isProcessing}
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              className={`ho-btn ${isDestructive ? "ho-btn-danger" : "ho-btn-primary"}`}
              disabled={!isValid || isProcessing}
            >
              {isProcessing ? "جارٍ التنفيذ..." : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
