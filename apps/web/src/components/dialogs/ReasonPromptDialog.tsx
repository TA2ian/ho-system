import React, { useState, useEffect, useRef } from "react";

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

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setTimeout(() => inputRef.current?.focus(), 50);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && !isProcessing) onCancel();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, isProcessing, onCancel]);

  if (!isOpen) return null;

  const isValid = reason.trim().length >= minCharacters;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid && !isProcessing) {
      onConfirm(reason.trim());
    }
  };

  return (
    <div className="ho-dialog-backdrop" role="presentation">
      <div
        className="ho-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reason-dialog-title"
      >
        <form onSubmit={handleSubmit}>
          <div className="ho-dialog-header">
            <h2 id="reason-dialog-title" className="ho-dialog-title">
              {title}
            </h2>
          </div>
          <div className="ho-dialog-body">
            <p className="ho-dialog-description">{description}</p>
            <div className="ho-form-field">
              <label htmlFor="reason-input" className="ho-label">
                {inputLabel}
              </label>
              <textarea
                id="reason-input"
                ref={inputRef}
                className="ho-textarea"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={placeholder}
                disabled={isProcessing}
                required
              />
              <small className="ho-field-hint">
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
