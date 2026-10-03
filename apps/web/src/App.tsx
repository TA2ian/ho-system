import { useEffect, useMemo, useState } from "react";
import { ApiClient } from "./api/client";
import { clearSession, getSession, setSession } from "./auth/session";
import { SalesOrdersPage } from "./modules/sales-orders/SalesOrdersPage";
import { InvoicesPage } from "./modules/invoices/InvoicesPage";
import { ReceivablesPage } from "./modules/receivables/ReceivablesPage";
import { PaymentsPage } from "./modules/payments/PaymentsPage";

import { AppShell } from "./components/layout/AppShell";
import type { NavItem } from "./components/layout/Sidebar";
import { SessionSurface } from "./components/session/SessionSurface";
import { StatusBadge } from "./components/common/StatusBadge";
import { FeedbackState } from "./components/common/FeedbackState";

const navItems: NavItem[] = [
  { id: "dashboard", label: "لوحة التحكم", category: "operations", status: "implemented" },
  { id: "customers", label: "العملاء", category: "operations", status: "implemented" },
  { id: "sales", label: "أوامر البيع", category: "operations", status: "implemented" },
  { id: "invoices", label: "الفواتير", category: "financials", status: "implemented" },
  { id: "receivables", label: "الذمم المدينة", category: "financials", status: "implemented" },
  { id: "payments", label: "التحصيل والمدفوعات", category: "financials", status: "implemented" },
  { id: "delivery", label: "التوصيل", category: "foundation", status: "foundation-only" },
  { id: "accounting", label: "المحاسبة", category: "foundation", status: "foundation-only" },
];

type Customer = {
  id: string;
  type: "individual" | "business";
  displayName: string;
  phone: string | null;
  email: string | null;
  status: string;
};

type Page<T> = { data: T[]; meta: { limit: number; offset: number; hasMore: boolean } };

export function App() {
  const [session, setSessionState] = useState(getSession());
  const [active, setActive] = useState<string>("dashboard");

  const api = useMemo(
    () => new ApiClient(import.meta.env.VITE_API_BASE_URL || "/api/v1/", () => session?.token ?? null),
    [session]
  );

  if (!session) {
    return (
      <SessionSurface
        onStartSession={(token) => {
          setSessionState(setSession(token));
        }}
      />
    );
  }

  const handleEndSession = () => {
    clearSession();
    setSessionState(null);
  };

  return (
    <AppShell
      navItems={navItems}
      activeId={active}
      onSelectNav={(id) => setActive(id)}
      onEndSession={handleEndSession}
    >
      {active === "dashboard" ? (
        <Dashboard api={api} />
      ) : active === "customers" ? (
        <Customers api={api} />
      ) : active === "sales" ? (
        <SalesOrdersPage api={api} />
      ) : active === "invoices" ? (
        <InvoicesPage api={api} />
      ) : active === "receivables" ? (
        <ReceivablesPage api={api} />
      ) : active === "payments" ? (
        <PaymentsPage api={api} />
      ) : (
        <FoundationalModulePlaceholder
          title={navItems.find((i) => i.id === active)?.label || active}
        />
      )}
    </AppShell>
  );
}

function Dashboard({ api }: { api: ApiClient }) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("لم يتم فحص الاتصال بالـ API في هذه الجلسة.");

  async function checkApi() {
    setState("loading");
    try {
      await api.get("customers?limit=1&offset=0");
      setState("ready");
      setMessage("الاتصال بـ API ومصادقة الرمز المؤقت تعمل بنجاح.");
    } catch (e) {
      setState("error");
      setMessage(e instanceof Error ? e.message : "تعذر الاتصال بالـ API.");
    }
  }

  return (
    <div className="dashboard-grid">
      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700 }}>حالة الاتصال بالخادم</h2>
          <StatusBadge
            status={state === "ready" ? "confirmed" : state === "error" ? "voided" : "pending"}
            label={state === "ready" ? "متصل" : state === "error" ? "خطأ اتصال" : "قيد الانتظار"}
          />
        </div>
        <p className="muted" style={{ marginBottom: "1.25rem" }}>
          {message}
        </p>
        <button
          type="button"
          className="ho-btn ho-btn-primary"
          onClick={() => void checkApi()}
          disabled={state === "loading"}
        >
          {state === "loading" ? "جارٍ الفحص..." : "فحص الاتصال الفعلي بالـ API"}
        </button>
      </section>

      <section className="panel">
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.75rem" }}>
          ضوابط الأمان والمعمارية
        </h2>
        <ul style={{ paddingRight: "1.25rem", lineHeight: "1.8", fontSize: "0.875rem", color: "var(--ho-color-text-muted)" }}>
          <li>رمز المصادقة (Bearer Token) محفوظ في الذاكرة الحية فقط.</li>
          <li>لا يتم كاش أي استجابات مالية في Service Worker.</li>
          <li>حسابات المبالغ والقيود المالية قطعية في الـ API وقاعدة البيانات.</li>
          <li>الواجهة لا تتجاوز حدود الصلاحيات وقواعد التحقق المقررة على الخادم.</li>
        </ul>
      </section>
    </div>
  );
}

function Customers({ api }: { api: ApiClient }) {
  const limit = 25;
  const [page, setPage] = useState<Page<Customer> | null>(null);
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"individual" | "business">("individual");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);

  async function load(nextOffset = offset) {
    setState("loading");
    setError(null);
    try {
      setPage(await api.get<Page<Customer>>(`customers?limit=${limit}&offset=${nextOffset}`));
      setOffset(nextOffset);
      setState("idle");
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "تعذر تحميل العملاء.");
    }
  }

  useEffect(() => {
    void load(0);
  }, []);

  async function create() {
    if (name.trim().length < 2) return setError("اسم العميل يجب أن يحتوي على حرفين على الأقل.");
    setCreating(true);
    setError(null);
    try {
      await api.post<Customer>(
        "customers",
        { type, displayName: name, phone: phone || null, email: email || null, notes: null },
        crypto.randomUUID()
      );
      setName("");
      setPhone("");
      setEmail("");
      setType("individual");
      await load(offset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إنشاء العميل.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="customers-page">
      <section className="panel" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700 }}>إضافة عميل جديد</h2>
          <button className="ho-btn ho-btn-secondary ho-btn-sm" type="button" onClick={() => void load(offset)} disabled={state === "loading"}>
            تحديث القائمة
          </button>
        </div>

        <div className="form-grid">
          <div className="ho-form-field">
            <label className="ho-label">الاسم</label>
            <input className="ho-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} placeholder="اسم العميل أو المنشأة" />
          </div>

          <div className="ho-form-field">
            <label className="ho-label">النوع</label>
            <select className="ho-select" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="individual">فرد</option>
              <option value="business">منشأة</option>
            </select>
          </div>

          <div className="ho-form-field">
            <label className="ho-label">الهاتف</label>
            <input className="ho-input" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={50} dir="ltr" placeholder="+963..." />
          </div>

          <div className="ho-form-field">
            <label className="ho-label">البريد الإلكتروني</label>
            <input className="ho-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={320} dir="ltr" placeholder="client@example.com" />
          </div>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <button type="button" className="ho-btn ho-btn-primary" onClick={() => void create()} disabled={creating}>
            {creating ? "جارٍ الإنشاء..." : "إضافة عميل"}
          </button>
        </div>

        {error && <p className="error" role="alert" style={{ marginTop: "0.75rem" }}>{error}</p>}
      </section>

      <section className="panel">
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "1rem" }}>العملاء النشطون</h2>
        {state === "loading" && <FeedbackState mode="loading" title="جارٍ تحميل سجل العملاء..." />}
        {state === "error" && !page && (
          <FeedbackState mode="error" title="تعذر تحميل سجل العملاء" message={error || undefined} onRetry={() => void load(offset)} />
        )}
        {page && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>النوع</th>
                    <th>الهاتف</th>
                    <th>البريد</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {page.data.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>
                        لا توجد نتائج مسجلة.
                      </td>
                    </tr>
                  ) : (
                    page.data.map((c) => (
                      <tr key={c.id}>
                        <td>{c.displayName}</td>
                        <td>{c.type === "business" ? "منشأة" : "فرد"}</td>
                        <td dir="ltr">{c.phone || "—"}</td>
                        <td dir="ltr">{c.email || "—"}</td>
                        <td>
                          <StatusBadge status={c.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pager">
              <button
                className="ho-btn ho-btn-secondary ho-btn-sm"
                type="button"
                disabled={offset === 0 || state === "loading"}
                onClick={() => void load(Math.max(0, offset - limit))}
              >
                السابق
              </button>
              <span className="ho-pagination-info">الصفحة {Math.floor(offset / limit) + 1}</span>
              <button
                className="ho-btn ho-btn-secondary ho-btn-sm"
                type="button"
                disabled={!page.meta.hasMore || state === "loading"}
                onClick={() => void load(offset + limit)}
              >
                التالي
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function FoundationalModulePlaceholder({ title }: { title: string }) {
  return (
    <div className="panel" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
      <StatusBadge status="placeholder" label="واجهة تشغيلية قيد الإعداد" />
      <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "1rem 0 0.5rem" }}>
        وحدة {title}
      </h2>
      <p className="muted" style={{ maxWidth: "560px", margin: "0 auto", lineHeight: "1.6" }}>
        عقود الـ API والتحقق الخادمي لهذه الوحدة قائمة ومؤسسة في البنية التحتية. الواجهة التشغيلية (Frontend Operational UI) قيد الإعداد للمراحل القادمة ولن تُعرض بيانات وهمية أو تدفقات زائفة.
      </p>
    </div>
  );
}
