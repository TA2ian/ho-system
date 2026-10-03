import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { ApiClient } from "../../api/client";
import { DataTable, type Column } from "../../components/common/DataTable";
import { Pagination } from "../../components/common/Pagination";
import { StatusBadge } from "../../components/common/StatusBadge";
import { FeedbackState } from "../../components/common/FeedbackState";
import { ResponsiveCardList } from "../../components/common/ResponsiveCardList";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";
import {
  CreateSalesOrderDialog,
  type CustomerRef,
  type CatalogItemRef,
} from "./CreateSalesOrderDialog";

interface SalesOrdersPageProps {
  api: ApiClient;
}

export interface SalesOrder {
  id: string;
  customerId: string;
  orderNumber: string;
  status: "draft" | "confirmed" | "cancelled";
  currencyCode: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OrdersApiResponse {
  data: SalesOrder[];
  meta: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface GenericPageResponse<T> {
  data: T[];
  meta: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export const SalesOrdersPage: React.FC<SalesOrdersPageProps> = ({ api }) => {
  const limit = 25;
  const [ordersPage, setOrdersPage] = useState<OrdersApiResponse | null>(null);
  const [offset, setOffset] = useState<number>(0);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // References state
  const [customers, setCustomers] = useState<CustomerRef[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItemRef[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // UI interaction states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "confirmed" | "cancelled">("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Confirm/Cancel action dialog states
  const [pendingAction, setPendingAction] = useState<{
    order: SalesOrder;
    action: "confirm" | "cancel";
  } | null>(null);
  const [isActionProcessing, setIsActionProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Customer ID to DisplayName map
  const customerById = useMemo(() => {
    return new Map(customers.map((c) => [c.id, c.displayName]));
  }, [customers]);

  // Load orders with decoupled offset dependency for robust pagination
  const loadOrders = useCallback(
    async (targetOffset: number) => {
      setState("loading");
      setError(null);
      try {
        const response = await api.get<OrdersApiResponse>(
          `sales-orders?limit=${limit}&offset=${targetOffset}`
        );
        setOrdersPage(response);
        setOffset(targetOffset);
        setState("idle");
      } catch (err) {
        setState("error");
        setError(err instanceof Error ? err.message : "تعذر استرجاع طلبات البيع من الخادم.");
      }
    },
    [api, limit]
  );

  // Load reference customers and catalog items
  const loadReferences = useCallback(async () => {
    setCustomersLoading(true);
    setCatalogLoading(true);
    try {
      const [custRes, catRes] = await Promise.all([
        api.get<GenericPageResponse<CustomerRef>>("customers?limit=200&offset=0"),
        api.get<GenericPageResponse<CatalogItemRef>>("catalog/items?limit=200&offset=0"),
      ]);
      setCustomers(custRes.data);
      setCatalogItems(catRes.data);
    } catch {
      // Non-fatal reference loading error, will show empty options with retry option
    } finally {
      setCustomersLoading(false);
      setCatalogLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadOrders(0);
    void loadReferences();
  }, [loadOrders, loadReferences]);

  const handleOrderCreated = () => {
    setToastMessage("تم إنشاء طلب البيع بنجاح بحالة مسودة (Draft).");
    setTimeout(() => setToastMessage(null), 5000);
    void loadOrders(offset);
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    setIsActionProcessing(true);
    setActionError(null);

    const { order, action } = pendingAction;
    try {
      const idempotencyKey = crypto.randomUUID();
      await api.post(`sales-orders/${order.id}/${action}`, {}, idempotencyKey);

      setToastMessage(
        action === "confirm"
          ? `تم تأكيد الطلب ${order.orderNumber} بنجاح.`
          : `تم إلغاء الطلب ${order.orderNumber}.`
      );
      setTimeout(() => setToastMessage(null), 5000);

      setPendingAction(null);
      await loadOrders(offset);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "تعذر تنفيذ العملية عبر الـ API.");
    } finally {
      setIsActionProcessing(false);
    }
  };

  // Safe client-side filtering on current page
  const filteredOrders = useMemo(() => {
    if (!ordersPage?.data) return [];
    return ordersPage.data.filter((order) => {
      const q = searchQuery.trim().toLowerCase();
      const customerName = (customerById.get(order.customerId) || "").toLowerCase();
      const matchesSearch =
        !q ||
        order.orderNumber.toLowerCase().includes(q) ||
        customerName.includes(q) ||
        (order.notes && order.notes.toLowerCase().includes(q));

      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [ordersPage?.data, searchQuery, statusFilter, customerById]);

  // Desktop table columns
  const columns: Column<SalesOrder>[] = [
    {
      key: "orderNumber",
      header: "رقم الطلب",
      dir: "ltr",
      render: (order) => (
        <div>
          <span style={{ fontWeight: 600, color: "var(--ho-color-text)" }}>
            {order.orderNumber}
          </span>
          {order.notes && (
            <div style={{ fontSize: "0.75rem", color: "var(--ho-color-text-muted)" }}>
              {order.notes}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "customerId",
      header: "العميل",
      render: (order) => (
        <span>{customerById.get(order.customerId) || order.customerId}</span>
      ),
    },
    {
      key: "status",
      header: "الحالة",
      render: (order) => <StatusBadge status={order.status} />,
    },
    {
      key: "currencyCode",
      header: "العملة",
      dir: "ltr",
      render: (order) => <code>{order.currencyCode}</code>,
    },
    {
      key: "createdAt",
      header: "تاريخ الإنشاء",
      dir: "ltr",
      render: (order) => (
        <span style={{ fontSize: "0.8125rem" }}>
          {new Date(order.createdAt).toLocaleDateString("ar-EG", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "id",
      header: "الإجراءات",
      render: (order) => {
        if (order.status !== "draft") {
          return <span className="muted" style={{ fontSize: "0.8125rem" }}>لا توجد إجراءات متاحة</span>;
        }
        return (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className="ho-btn ho-btn-secondary ho-btn-sm"
              onClick={() => setPendingAction({ order, action: "confirm" })}
            >
              تأكيد الطلب
            </button>
            <button
              type="button"
              className="ho-btn ho-btn-danger ho-btn-sm"
              onClick={() => setPendingAction({ order, action: "cancel" })}
            >
              إلغاء
            </button>
          </div>
        );
      },
    },
  ];

  // Mobile card render
  const renderOrderCard = (order: SalesOrder) => (
    <div className="ho-customer-card">
      <div className="ho-customer-card-header">
        <div>
          <span className="ho-customer-card-title" dir="ltr">{order.orderNumber}</span>
          <div style={{ fontSize: "0.875rem", color: "var(--ho-color-text)", marginTop: "0.25rem", fontWeight: 500 }}>
            {customerById.get(order.customerId) || order.customerId}
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="ho-customer-card-details">
        <div className="ho-customer-card-row">
          <span>العملة:</span>
          <code dir="ltr">{order.currencyCode}</code>
        </div>
        <div className="ho-customer-card-row">
          <span>التاريخ:</span>
          <span dir="ltr">
            {new Date(order.createdAt).toLocaleDateString("ar-EG", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
        {order.notes && (
          <div className="ho-customer-card-row">
            <span>ملاحظات:</span>
            <span>{order.notes}</span>
          </div>
        )}
      </div>

      {order.status === "draft" && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--ho-color-border, #e2e8f0)" }}>
          <button
            type="button"
            className="ho-btn ho-btn-secondary ho-btn-sm"
            style={{ flex: 1 }}
            onClick={() => setPendingAction({ order, action: "confirm" })}
          >
            تأكيد الطلب
          </button>
          <button
            type="button"
            className="ho-btn ho-btn-danger ho-btn-sm"
            style={{ flex: 1 }}
            onClick={() => setPendingAction({ order, action: "cancel" })}
          >
            إلغاء الطلب
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="sales-orders-page">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className="ho-alert ho-alert-success"
          role="status"
          aria-live="polite"
          style={{ marginBottom: "1.25rem" }}
        >
          <span>✓</span>
          <div>{toastMessage}</div>
        </div>
      )}

      {/* Page Header */}
      <header className="ho-page-header">
        <div>
          <h1 className="ho-page-header-title">طلبات البيع</h1>
          <p className="ho-page-header-desc">
            سجل وتفاصيل طلبات البيع في النظام وحالات الانتقال بين المسودة والتأكيد.
          </p>
        </div>
        <div className="ho-page-header-actions">
          <button
            type="button"
            className="ho-btn ho-btn-secondary"
            onClick={() => {
              void loadOrders(offset);
              void loadReferences();
            }}
            disabled={state === "loading"}
          >
            تحديث
          </button>
          <button
            type="button"
            className="ho-btn ho-btn-primary"
            onClick={() => setIsCreateOpen(true)}
          >
            + إنشاء طلب جديد
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <section className="panel" aria-label="قائمة طلبات البيع">
        {/* Loading State */}
        {state === "loading" && !ordersPage && (
          <FeedbackState mode="loading" title="جارٍ تحميل طلبات البيع من الخادم..." />
        )}

        {/* Error State */}
        {state === "error" && !ordersPage && (
          <FeedbackState
            mode="error"
            title="تعذر تحميل طلبات البيع"
            message={error || undefined}
            onRetry={() => void loadOrders(offset)}
          />
        )}

        {/* Empty State */}
        {ordersPage && ordersPage.data.length === 0 && (
          <FeedbackState
            mode="empty"
            title="لا توجد طلبات بيع مسجلة حاليًا"
            message="لم يتم تسجيل أي طلب بيع في النظام حتى الآن. يمكنك البدء بإنشاء أول طلب عبر الزر أدناه."
            onAction={() => setIsCreateOpen(true)}
            actionLabel="إنشاء أول طلب بيع"
          />
        )}

        {/* Loaded Data View */}
        {ordersPage && ordersPage.data.length > 0 && (
          <>
            {/* Toolbar for quick filter */}
            <div className="ho-toolbar" role="search" aria-label="تصفية طلبات البيع في الصفحة الحالية">
              <div className="ho-toolbar-search">
                <input
                  type="search"
                  className="ho-input ho-input-sm"
                  placeholder="بحث سريع برقم الطلب، اسم العميل، أو الملاحظات..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="بحث سريع في الصفحة الحالية"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="ho-btn ho-btn-secondary ho-btn-sm"
                    onClick={() => setSearchQuery("")}
                  >
                    مسح
                  </button>
                )}
              </div>

              <div className="ho-toolbar-filters">
                <label htmlFor="ho-so-status-filter" className="sr-only">
                  تصفية حسب حالة الطلب
                </label>
                <select
                  id="ho-so-status-filter"
                  className="ho-select ho-select-sm"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "all" | "draft" | "confirmed" | "cancelled")
                  }
                >
                  <option value="all">كافة الحالات ({ordersPage.data.length})</option>
                  <option value="draft">المسودة (Draft)</option>
                  <option value="confirmed">المؤكدة (Confirmed)</option>
                  <option value="cancelled">الملغاة (Cancelled)</option>
                </select>
              </div>
            </div>

            {/* Empty Filter State */}
            {filteredOrders.length === 0 ? (
              <div style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
                <p className="muted" style={{ marginBottom: "1rem" }}>
                  لا توجد نتائج مطابقة لمعايير البحث في هذه الصفحة.
                </p>
                <button
                  type="button"
                  className="ho-btn ho-btn-secondary ho-btn-sm"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                >
                  إعادة ضبط التصفية
                </button>
              </div>
            ) : (
              <>
                {/* Desktop View */}
                <div className="ho-desktop-only">
                  <DataTable<SalesOrder>
                    data={filteredOrders}
                    columns={columns}
                    keyExtractor={(order) => order.id}
                    caption="جدول طلبات البيع"
                  />
                </div>

                {/* Mobile View */}
                <div className="ho-mobile-only">
                  <ResponsiveCardList<SalesOrder>
                    items={filteredOrders}
                    keyExtractor={(order) => order.id}
                    renderCard={renderOrderCard}
                  />
                </div>
              </>
            )}

            {/* Pagination Component */}
            <Pagination
              offset={offset}
              limit={limit}
              hasMore={ordersPage.meta.hasMore}
              onPageChange={(newOffset) => void loadOrders(newOffset)}
              disabled={state === "loading"}
            />
          </>
        )}
      </section>

      {/* Create Sales Order Dialog */}
      <CreateSalesOrderDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleOrderCreated}
        api={api}
        customers={customers}
        catalogItems={catalogItems}
        customersLoading={customersLoading}
        catalogLoading={catalogLoading}
      />

      {/* Confirm Action Dialog */}
      {pendingAction && (
        <ConfirmDialog
          isOpen={true}
          title={
            pendingAction.action === "confirm"
              ? "تأكيد طلب البيع"
              : "إلغاء طلب البيع"
          }
          description={
            pendingAction.action === "confirm"
              ? `هل أنت متأكد من رغبتك في تأكيد الطلب ${pendingAction.order.orderNumber}؟ سينتقل الطلب من حالة مسودة إلى مؤكد. لا تُنشئ هذه العملية أي قيود محاسبية أو ذمم مدينة.`
              : `هل أنت متأكد من رغبتك في إلغاء الطلب ${pendingAction.order.orderNumber}؟ إلغاء الطلب انتقال نهائي من حالة مسودة إلى ملغى.`
          }
          confirmLabel={
            pendingAction.action === "confirm" ? "تأكيد الطلب" : "إلغاء الطلب نهائيًا"
          }
          cancelLabel="تراجع"
          isDestructive={pendingAction.action === "cancel"}
          isProcessing={isActionProcessing}
          onConfirm={() => void handleConfirmAction()}
          onCancel={() => {
            if (!isActionProcessing) {
              setPendingAction(null);
              setActionError(null);
            }
          }}
        />
      )}

      {/* Action Error Alert if mutation fails */}
      {actionError && (
        <div
          className="ho-alert ho-alert-danger"
          role="alert"
          style={{ marginTop: "1rem" }}
        >
          <span className="ho-alert-icon">⚠️</span>
          <div className="ho-alert-content">
            <strong>خطأ في تنفيذ الإجراء:</strong> {actionError}
          </div>
        </div>
      )}
    </div>
  );
};
