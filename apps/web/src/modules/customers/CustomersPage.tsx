import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { ApiClient } from "../../api/client";
import { DataTable, type Column } from "../../components/common/DataTable";
import { Pagination } from "../../components/common/Pagination";
import { StatusBadge } from "../../components/common/StatusBadge";
import { FeedbackState } from "../../components/common/FeedbackState";
import { ResponsiveCardList } from "../../components/common/ResponsiveCardList";
import { CreateCustomerDialog, type Customer } from "./CreateCustomerDialog";

interface CustomersPageProps {
  api: ApiClient;
}

interface CustomersApiResponse {
  data: Customer[];
  meta: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export const CustomersPage: React.FC<CustomersPageProps> = ({ api }) => {
  const limit = 25;
  const [page, setPage] = useState<CustomersApiResponse | null>(null);
  const [offset, setOffset] = useState<number>(0);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Dialog and filter states
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<"all" | "individual" | "business">("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadCustomers = useCallback(
    async (nextOffset: number = offset) => {
      setState("loading");
      setError(null);
      try {
        const response = await api.get<CustomersApiResponse>(
          `customers?limit=${limit}&offset=${nextOffset}`
        );
        setPage(response);
        setOffset(nextOffset);
        setState("idle");
      } catch (err) {
        setState("error");
        setError(err instanceof Error ? err.message : "تعذر استرجاع سجل العملاء من الخادم.");
      }
    },
    [api, limit, offset]
  );

  useEffect(() => {
    void loadCustomers(0);
  }, [loadCustomers]);

  const handleCustomerCreated = (newCustomer: Customer) => {
    setToastMessage(`تم تسجيل العميل "${newCustomer.displayName}" بنجاح في النظام.`);
    setTimeout(() => {
      setToastMessage(null);
    }, 5000);
    void loadCustomers(offset);
  };

  // Safe client-side search & filtering on currently loaded page items
  const filteredCustomers = useMemo(() => {
    if (!page?.data) return [];
    return page.data.filter((c) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        c.displayName.toLowerCase().includes(query) ||
        (c.phone && c.phone.includes(query)) ||
        (c.email && c.email.toLowerCase().includes(query));

      const matchesType = typeFilter === "all" || c.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [page?.data, searchQuery, typeFilter]);

  const columns: Column<Customer>[] = [
    {
      key: "displayName",
      header: "اسم العميل / المنشأة",
      render: (c) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--ho-color-text)" }}>{c.displayName}</div>
          {c.notes && (
            <div style={{ fontSize: "0.75rem", color: "var(--ho-color-text-muted)" }}>
              {c.notes}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "التصنيف",
      render: (c) => (
        <span className="ho-badge ho-badge-neutral">
          {c.type === "business" ? "منشأة تجارية" : "فرد"}
        </span>
      ),
    },
    {
      key: "phone",
      header: "رقم الهاتف",
      dir: "ltr",
      render: (c) => (c.phone ? <span>{c.phone}</span> : <span className="muted">—</span>),
    },
    {
      key: "email",
      header: "البريد الإلكتروني",
      dir: "ltr",
      render: (c) => (c.email ? <span>{c.email}</span> : <span className="muted">—</span>),
    },
    {
      key: "status",
      header: "الحالة",
      render: (c) => <StatusBadge status={c.status} />,
    },
  ];

  const renderCustomerCard = (c: Customer) => (
    <div className="ho-customer-card">
      <div className="ho-customer-card-header">
        <div>
          <span className="ho-customer-card-title">{c.displayName}</span>
          <div style={{ marginTop: "0.25rem" }}>
            <span className="ho-badge ho-badge-neutral">
              {c.type === "business" ? "منشأة تجارية" : "فرد"}
            </span>
          </div>
        </div>
        <StatusBadge status={c.status} />
      </div>

      <div className="ho-customer-card-details">
        <div className="ho-customer-card-row">
          <span>الهاتف:</span>
          <span dir="ltr">{c.phone || "—"}</span>
        </div>
        <div className="ho-customer-card-row">
          <span>البريد الإلكتروني:</span>
          <span dir="ltr">{c.email || "—"}</span>
        </div>
        {c.notes && (
          <div className="ho-customer-card-row">
            <span>ملاحظات:</span>
            <span>{c.notes}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="customers-page">
      {/* Toast Announcement for Screen Readers & Visual Feedback */}
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
          <h1 className="ho-page-header-title">إدارة العملاء</h1>
          <p className="ho-page-header-desc">
            سجل العملاء النشطين وتصنيفهم بين أفراد ومنشآت، والبيانات المعتمدة للمبيعات والتحصيل.
          </p>
        </div>
        <div className="ho-page-header-actions">
          <button
            type="button"
            className="ho-btn ho-btn-secondary"
            onClick={() => void loadCustomers(offset)}
            disabled={state === "loading"}
          >
            تحديث القائمة
          </button>
          <button
            type="button"
            className="ho-btn ho-btn-primary"
            onClick={() => setIsCreateOpen(true)}
          >
            + إضافة عميل جديد
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <section className="panel" aria-label="قائمة العملاء">
        {/* Loading State */}
        {state === "loading" && !page && (
          <FeedbackState mode="loading" title="جارٍ تحميل سجل العملاء من الخادم..." />
        )}

        {/* Error State */}
        {state === "error" && !page && (
          <FeedbackState
            mode="error"
            title="تعذر تحميل سجل العملاء"
            message={error || undefined}
            onRetry={() => void loadCustomers(offset)}
          />
        )}

        {/* Empty State when no customers exist on system */}
        {page && page.data.length === 0 && (
          <FeedbackState
            mode="empty"
            title="لا يوجد عملاء مسجلون حاليًا"
            message="لم يتم تسجيل أي عميل في النظام حتى الآن. يمكنك البدء بإضافة أول عميل عبر الزر أدناه."
            onAction={() => setIsCreateOpen(true)}
            actionLabel="إضافة أول عميل"
          />
        )}

        {/* When data exists */}
        {page && page.data.length > 0 && (
          <>
            {/* Toolbar for quick filter */}
            <div className="ho-toolbar" role="search" aria-label="تصفية العملاء في الصفحة الحالية">
              <div className="ho-toolbar-search">
                <input
                  type="search"
                  className="ho-input ho-input-sm"
                  placeholder="بحث سريع بالاسم، الهاتف، أو البريد في الصفحة الحالية..."
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
                <label htmlFor="ho-cust-type-filter" className="sr-only">
                  تصفية حسب نوع العميل
                </label>
                <select
                  id="ho-cust-type-filter"
                  className="ho-select ho-select-sm"
                  value={typeFilter}
                  onChange={(e) =>
                    setTypeFilter(e.target.value as "all" | "individual" | "business")
                  }
                >
                  <option value="all">كافة التصنيفات ({page.data.length})</option>
                  <option value="individual">الأفراد فقط</option>
                  <option value="business">المنشآت فقط</option>
                </select>
              </div>
            </div>

            {/* Filter Empty State (when search returns 0 on current page) */}
            {filteredCustomers.length === 0 ? (
              <div style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
                <p className="muted" style={{ marginBottom: "1rem" }}>
                  لا توجد نتائج مطابقة لمعايير البحث في هذه الصفحة.
                </p>
                <button
                  type="button"
                  className="ho-btn ho-btn-secondary ho-btn-sm"
                  onClick={() => {
                    setSearchQuery("");
                    setTypeFilter("all");
                  }}
                >
                  إعادة ضبط التصفية
                </button>
              </div>
            ) : (
              <>
                {/* Desktop Data Table */}
                <div className="ho-desktop-only">
                  <DataTable<Customer>
                    data={filteredCustomers}
                    columns={columns}
                    keyExtractor={(c) => c.id}
                    caption="جدول العملاء النشطين"
                  />
                </div>

                {/* Mobile Responsive Cards */}
                <div className="ho-mobile-only">
                  <ResponsiveCardList<Customer>
                    items={filteredCustomers}
                    keyExtractor={(c) => c.id}
                    renderCard={renderCustomerCard}
                  />
                </div>
              </>
            )}

            {/* Pagination Component */}
            <Pagination
              offset={offset}
              limit={limit}
              hasMore={page.meta.hasMore}
              onPageChange={(newOffset) => void loadCustomers(newOffset)}
              disabled={state === "loading"}
            />
          </>
        )}
      </section>

      {/* Create Customer Dialog Modal */}
      <CreateCustomerDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleCustomerCreated}
        api={api}
      />
    </div>
  );
};
