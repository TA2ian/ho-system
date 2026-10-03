import React, { useState, useEffect, useRef, useId, useCallback, useMemo } from "react";
import type { ApiClient } from "../../api/client";

export interface CustomerRef {
  id: string;
  displayName: string;
  status: string;
}

export interface CatalogItemRef {
  id: string;
  code: string;
  name: string;
  unit: string;
  currencyCode: string;
  salePrice: string;
  isActive: boolean;
}

interface OrderLineInput {
  catalogItemId: string;
  quantity: string;
}

interface CreateSalesOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  api: ApiClient;
  customers: CustomerRef[];
  catalogItems: CatalogItemRef[];
  customersLoading?: boolean;
  catalogLoading?: boolean;
}

// Regex to validate quantity format without IEEE-754 floating point arithmetic
const DECIMAL_PATTERN = /^\d+(\.\d{1,10})?$/;
const ZERO_PATTERN = /^0+(\.0+)?$/;

export const CreateSalesOrderDialog: React.FC<CreateSalesOrderDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  api,
  customers,
  catalogItems,
  customersLoading = false,
  catalogLoading = false,
}) => {
  const [customerId, setCustomerId] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<OrderLineInput[]>([{ catalogItemId: "", quantity: "1" }]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [touched, setTouched] = useState<{ customer?: boolean; lines?: boolean }>({});

  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  const autoId = useId();
  const titleId = `ho-so-title-${autoId}`;
  const descId = `ho-so-desc-${autoId}`;
  const customerIdAttr = `ho-so-cust-${autoId}`;
  const currencyIdAttr = `ho-so-curr-${autoId}`;
  const notesIdAttr = `ho-so-notes-${autoId}`;

  // Unique list of currencies available in catalog
  const availableCurrencies = useMemo(() => {
    return Array.from(new Set(catalogItems.map((item) => item.currencyCode))).sort();
  }, [catalogItems]);

  // Catalog items filtered by chosen currency
  const filteredCatalogItems = useMemo(() => {
    if (!currencyCode) return [];
    return catalogItems.filter((item) => item.currencyCode === currencyCode && item.isActive);
  }, [catalogItems, currencyCode]);

  // Reset and focus management
  useEffect(() => {
    if (isOpen) {
      triggerElementRef.current = document.activeElement as HTMLElement | null;
      setCustomerId("");
      setNotes("");
      setApiError(null);
      setTouched({});

      // Default currency selection
      if (availableCurrencies.length > 0) {
        setCurrencyCode(availableCurrencies[0]);
      } else {
        setCurrencyCode("");
      }
      setLines([{ catalogItemId: "", quantity: "1" }]);

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const timer = setTimeout(() => {
        const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
          'select, input, button:not([disabled])'
        );
        firstFocusable?.focus();
      }, 40);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = originalOverflow;
        if (triggerElementRef.current && typeof triggerElementRef.current.focus === "function") {
          triggerElementRef.current.focus();
        }
      };
    }
  }, [isOpen, availableCurrencies]);

  // Decimal-safe validation for each line
  const isLineValid = (line: OrderLineInput) => {
    if (!line.catalogItemId.trim()) return false;
    const trimmedQty = line.quantity.trim();
    if (!DECIMAL_PATTERN.test(trimmedQty)) return false;
    if (ZERO_PATTERN.test(trimmedQty)) return false;
    return true;
  };

  const areLinesValid = lines.length > 0 && lines.every(isLineValid);
  const isCustomerValid = customerId.trim().length > 0;
  const isFormValid = isCustomerValid && currencyCode.trim().length > 0 && areLinesValid;

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

  const updateLine = (index: number, patch: Partial<OrderLineInput>) => {
    setLines((prev) =>
      prev.map((line, idx) => (idx === index ? { ...line, ...patch } : line))
    );
  };

  const addLine = () => {
    setLines((prev) => [...prev, { catalogItemId: "", quantity: "1" }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCurrencyChange = (newCurrency: string) => {
    setCurrencyCode(newCurrency);
    // Reset catalog items selection when currency changes to avoid mismatch
    setLines([{ catalogItemId: "", quantity: "1" }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ customer: true, lines: true });

    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setApiError(null);

    try {
      const payload = {
        customerId,
        currencyCode,
        notes: notes.trim() ? notes.trim() : null,
        lines: lines.map((l) => ({
          catalogItemId: l.catalogItemId,
          quantity: l.quantity.trim(),
        })),
      };

      const idempotencyKey = crypto.randomUUID();
      await api.post("sales-orders", payload, idempotencyKey);

      onSuccess();
      onClose();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "تعذر إنشاء طلب البيع عبر الـ API.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

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
        className="ho-dialog ho-dialog-lg"
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
                إنشاء طلب بيع جديد
              </h2>
              <p id={descId} className="ho-dialog-description">
                إنشاء طلب بيع في حالة مسودة (Draft). لا يُنشئ هذا الإجراء أي قيود محاسبية أو ذمم مدينة.
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
                className="ho-alert ho-alert-danger"
                role="alert"
                aria-live="assertive"
                style={{ marginBottom: "1rem" }}
              >
                <span className="ho-alert-icon">⚠️</span>
                <div className="ho-alert-content">
                  <strong>خطأ في إنشاء الطلب:</strong> {apiError}
                </div>
              </div>
            )}

            <div className="ho-form-grid" style={{ marginBottom: "1.25rem" }}>
              {/* Customer selection */}
              <div className="ho-form-field">
                <label htmlFor={customerIdAttr} className="ho-label">
                  العميل <span className="ho-required-marker">*</span>
                </label>
                <select
                  id={customerIdAttr}
                  className={`ho-select ${touched.customer && !isCustomerValid ? "ho-input-error" : ""}`}
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, customer: true }))}
                  disabled={isSubmitting || customersLoading}
                  required
                >
                  <option value="">
                    {customersLoading ? "جارٍ تحميل العملاء..." : "-- اختر العميل من السجل --"}
                  </option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName}
                    </option>
                  ))}
                </select>
                {touched.customer && !isCustomerValid && (
                  <span className="ho-field-error" role="alert">
                    يجب اختيار العميل لإتمام إنشاء الطلب.
                  </span>
                )}
              </div>

              {/* Currency selection */}
              <div className="ho-form-field">
                <label htmlFor={currencyIdAttr} className="ho-label">
                  عملة الطلب <span className="ho-required-marker">*</span>
                </label>
                <select
                  id={currencyIdAttr}
                  className="ho-select"
                  value={currencyCode}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  disabled={isSubmitting || catalogLoading || availableCurrencies.length === 0}
                  required
                >
                  {availableCurrencies.length === 0 ? (
                    <option value="">
                      {catalogLoading ? "جارٍ تحميل العملات..." : "لا توجد عناصر في الكتالوج"}
                    </option>
                  ) : (
                    availableCurrencies.map((curr) => (
                      <option key={curr} value={curr}>
                        {curr}
                      </option>
                    ))
                  )}
                </select>
                <span className="muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>
                  تُعرض عناصر الكتالوج المطابقة لعملة الطلب فقط.
                </span>
              </div>
            </div>

            {/* Order Lines */}
            <div className="ho-order-lines-section" style={{ marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--ho-color-text)", margin: 0 }}>
                  عناصر وسطور الطلب <span className="ho-required-marker">*</span>
                </h3>
                <button
                  type="button"
                  className="ho-btn ho-btn-secondary ho-btn-sm"
                  onClick={addLine}
                  disabled={isSubmitting || filteredCatalogItems.length === 0}
                >
                  + إضافة سطر
                </button>
              </div>

              {filteredCatalogItems.length === 0 && !catalogLoading && (
                <div className="ho-alert" style={{ backgroundColor: "#fef3c7", border: "1px solid #fde68a", color: "#92400e" }}>
                  لا توجد عناصر كتالوج نشطة متوفرة بالعملة المختارة ({currencyCode || "غير محددة"}).
                </div>
              )}

              <div className="ho-order-lines-list" style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                {lines.map((line, index) => {
                  const lineValid = isLineValid(line);
                  const isQtyValid =
                    DECIMAL_PATTERN.test(line.quantity.trim()) && !ZERO_PATTERN.test(line.quantity.trim());

                  return (
                    <div
                      key={index}
                      className="ho-order-line-row"
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        alignItems: "flex-start",
                        padding: "0.75rem",
                        background: "var(--ho-color-surface-hover, #f8fafc)",
                        border: "1px solid var(--ho-color-border, #e2e8f0)",
                        borderRadius: "var(--ho-radius-md, 6px)",
                      }}
                    >
                      {/* Catalog Item Selection */}
                      <div style={{ flex: 3 }}>
                        <label className="sr-only" htmlFor={`ho-so-line-item-${index}`}>
                          عنصر الكتالوج للسطر {index + 1}
                        </label>
                        <select
                          id={`ho-so-line-item-${index}`}
                          className={`ho-select ${touched.lines && !line.catalogItemId ? "ho-input-error" : ""}`}
                          value={line.catalogItemId}
                          onChange={(e) => updateLine(index, { catalogItemId: e.target.value })}
                          disabled={isSubmitting || filteredCatalogItems.length === 0}
                          required
                        >
                          <option value="">-- اختر العنصر من الكتالوج --</option>
                          {filteredCatalogItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.code} — {item.name} ({item.salePrice} {item.currencyCode} / {item.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity Input */}
                      <div style={{ flex: 1, minWidth: "100px" }}>
                        <label className="sr-only" htmlFor={`ho-so-line-qty-${index}`}>
                          الكمية للسطر {index + 1}
                        </label>
                        <input
                          id={`ho-so-line-qty-${index}`}
                          type="text"
                          dir="ltr"
                          inputMode="decimal"
                          className={`ho-input ${touched.lines && !isQtyValid ? "ho-input-error" : ""}`}
                          value={line.quantity}
                          onChange={(e) => updateLine(index, { quantity: e.target.value })}
                          placeholder="الكمية"
                          disabled={isSubmitting}
                          required
                        />
                        {touched.lines && !isQtyValid && (
                          <span className="ho-field-error" style={{ fontSize: "0.7rem" }} role="alert">
                            رقم عشري موجب &gt; 0
                          </span>
                        )}
                      </div>

                      {/* Delete Line Button */}
                      <div>
                        <button
                          type="button"
                          className="ho-btn ho-btn-secondary"
                          style={{ color: "#dc2626", padding: "0.375rem 0.625rem" }}
                          onClick={() => removeLine(index)}
                          disabled={lines.length <= 1 || isSubmitting}
                          title={lines.length <= 1 ? "يجب أن يحتوي الطلب على سطر واحد على الأقل" : "حذف السطر"}
                          aria-label={`حذف السطر ${index + 1}`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notes Field */}
            <div className="ho-form-field">
              <label htmlFor={notesIdAttr} className="ho-label">
                ملاحظات الطلب <span className="ho-optional-marker">(اختياري)</span>
              </label>
              <textarea
                id={notesIdAttr}
                className="ho-textarea"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="تعليمات التسليم أو أي ملاحظات تشغيلية تخص الطلب..."
                maxLength={2000}
                disabled={isSubmitting}
              />
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
              {isSubmitting ? "جارٍ الإنشاء..." : "حفظ وإنشاء الطلب"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
