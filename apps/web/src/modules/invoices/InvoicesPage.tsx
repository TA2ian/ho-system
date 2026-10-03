import { useEffect, useMemo, useState } from "react";
import type { ApiClient } from "../../api/client";

type Page<T> = { data: T[]; meta: { limit: number; offset: number; hasMore: boolean } };
type SalesOrder = {
  id: string;
  customerId: string;
  orderNumber: string;
  status: "draft" | "confirmed" | "cancelled";
  currencyCode: string;
  notes: string | null;
  createdAt: string;
};
type Customer = { id: string; displayName: string; status: string };
type Invoice = {
  id: string;
  customerId: string;
  sourceSalesOrderId: string | null;
  invoiceNumber: string;
  status: "draft" | "issued" | "voided";
  currencyCode: string;
  totalAmount: string;
  issueDate: string | null;
  dueDate: string | null;
  notes: string | null;
  createdAt: string;
};
type InvoiceDetail = { invoice: Invoice; lines: unknown[] };

const statusLabels: Record<Invoice["status"], string> = {
  draft: "مسودة",
  issued: "صادرة",
  voided: "ملغاة"
};

export function InvoicesPage({ api }: { api: ApiClient }) {
  const limit = 25;
  const [invoices, setInvoices] = useState<Page<Invoice> | null>(null);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [working, setWorking] = useState<string | null>(null);

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer.displayName])),
    [customers]
  );
  const confirmedOrders = useMemo(
    () => orders.filter((order) => order.status === "confirmed"),
    [orders]
  );

  async function loadInvoices(nextOffset = offset) {
    setState("loading");
    setError(null);
    try {
      setInvoices(await api.get<Page<Invoice>>(`invoices?limit=${limit}&offset=${nextOffset}`));
      setOffset(nextOffset);
      setState("idle");
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "تعذر تحميل الفواتير.");
    }
  }

  async function loadReferences() {
    try {
      const [orderPage, customerPage] = await Promise.all([
        api.get<Page<SalesOrder>>("sales-orders?limit=200&offset=0"),
        api.get<Page<Customer>>("customers?limit=200&offset=0")
      ]);
      setOrders(orderPage.data);
      setCustomers(customerPage.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل الطلبات والعملاء.");
    }
  }

  useEffect(() => {
    void loadReferences();
    void loadInvoices(0);
  }, []);

  async function createInvoice() {
    if (!selectedOrder) return setError("اختر طلب بيع مؤكدًا.");
    setWorking("create");
    setError(null);
    try {
      await api.post(
        "invoices",
        {
          salesOrderId: selectedOrder,
          dueDate: dueDate || null,
          notes: notes.trim() || null
        },
        crypto.randomUUID()
      );
      setSelectedOrder("");
      setDueDate("");
      setNotes("");
      await loadInvoices(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إنشاء الفاتورة.");
    } finally {
      setWorking(null);
    }
  }

  async function issue(invoiceId: string) {
    setWorking(invoiceId);
    setError(null);
    try {
      await api.post(`invoices/${invoiceId}/issue`, {}, crypto.randomUUID());
      await loadInvoices(offset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إصدار الفاتورة وترحيلها.");
    } finally {
      setWorking(null);
    }
  }

  async function voidInvoice(invoiceId: string) {
    if (voidReason.trim().length < 3) return setError("أدخل سببًا واضحًا لإلغاء الفاتورة.");
    setWorking(invoiceId);
    setError(null);
    try {
      await api.post(
        `invoices/${invoiceId}/void`,
        { reason: voidReason.trim() },
        crypto.randomUUID()
      );
      setVoidReason("");
      await loadInvoices(offset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إلغاء الفاتورة.");
    } finally {
      setWorking(null);
    }
  }

  return <div className="invoices-page">
    <section className="panel">
      <div className="section-heading">
        <div><span className="eyebrow">الدورة المالية</span><h2>إنشاء فاتورة</h2></div>
      </div>
      <p className="muted">الفاتورة تُنشأ من طلب بيع مؤكد فقط. إصدار الفاتورة يرحّلها محاسبيًا.</p>
      <div className="form-grid">
        <label>طلب البيع المؤكد
          <select value={selectedOrder} onChange={(e) => setSelectedOrder(e.target.value)}>
            <option value="">اختر الطلب</option>
            {confirmedOrders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} — {customerById.get(order.customerId) || order.customerId} — {order.currencyCode}</option>)}
          </select>
        </label>
        <label>تاريخ الاستحقاق
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <label>ملاحظات
          <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </label>
        <button type="button" onClick={() => void createInvoice()} disabled={working === "create"}>
          {working === "create" ? "جارٍ الإنشاء…" : "إنشاء الفاتورة"}
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </section>

    <section className="panel">
      <div className="section-heading">
        <div><span className="eyebrow">السجل</span><h2>الفواتير</h2></div>
        <button className="secondary" type="button" onClick={() => void loadInvoices(offset)} disabled={state === "loading"}>تحديث</button>
      </div>
      {state === "loading" && <p className="muted">جارٍ تحميل الفواتير…</p>}
      {invoices && <div className="table-wrap">
        <table>
          <thead><tr><th>الفاتورة</th><th>العميل</th><th>الحالة</th><th>الإجمالي</th><th>الاستحقاق</th><th>الإجراء</th></tr></thead>
          <tbody>
            {invoices.data.length === 0 ? <tr><td colSpan={6}>لا توجد فواتير.</td></tr> : invoices.data.map((invoice) => <tr key={invoice.id}>
              <td dir="ltr">{invoice.invoiceNumber}</td>
              <td>{customerById.get(invoice.customerId) || invoice.customerId}</td>
              <td>{statusLabels[invoice.status]}</td>
              <td dir="ltr">{invoice.totalAmount} {invoice.currencyCode}</td>
              <td dir="ltr">{invoice.dueDate || "—"}</td>
              <td>
                {invoice.status === "draft" && <span className="row-actions"><button className="secondary" type="button" disabled={working === invoice.id} onClick={() => void issue(invoice.id)}>إصدار وترحيل</button><button className="danger" type="button" disabled={working === invoice.id} onClick={() => void voidInvoice(invoice.id)}>إلغاء</button></span>}
                {invoice.status === "issued" && <button className="danger" type="button" disabled={working === invoice.id} onClick={() => void voidInvoice(invoice.id)}>إلغاء</button>}
                {invoice.status === "voided" && "—"}
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>}
      <div className="void-reason">
        <label>سبب إلغاء الفاتورة
          <input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} maxLength={500} placeholder="يُستخدم عند الضغط على إلغاء" />
        </label>
      </div>
      {invoices && <div className="pager">
        <button className="secondary" type="button" disabled={offset === 0 || state === "loading"} onClick={() => void loadInvoices(Math.max(0, offset - limit))}>السابق</button>
        <span>الصفحة {Math.floor(offset / limit) + 1}</span>
        <button className="secondary" type="button" disabled={!invoices.meta.hasMore || state === "loading"} onClick={() => void loadInvoices(offset + limit)}>التالي</button>
      </div>}
    </section>
  </div>;
}
