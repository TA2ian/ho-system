import React, { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isProcessing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  isDestructive = false,
  isProcessing = false,
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      confirmBtnRef.current?.focus();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && !isProcessing) onCancel();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, isProcessing, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="ho-dialog-backdrop" role="presentation">
      <div
        className="ho-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-desc"
        ref={dialogRef}
      >
        <div className="ho-dialog-header">
          <h2 id="dialog-title" className="ho-dialog-title">
            {title}
          </h2>
        </div>
        <div className="ho-dialog-body">
          <p id="dialog-desc" className="ho-dialog-description">
            {description}
          </p>
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
            ref={confirmBtnRef}
            type="button"
            className={`ho-btn ${isDestructive ? "ho-btn-danger" : "ho-btn-primary"}`}
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? "جارٍ التنفيذ..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
