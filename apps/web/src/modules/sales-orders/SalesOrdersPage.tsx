import { useEffect, useMemo, useState } from "react";
import type { ApiClient } from "../../api/client";

type Page<T> = { data: T[]; meta: { limit: number; offset: number; hasMore: boolean } };
type Customer = { id: string; displayName: string; status: string };
type CatalogItem = {
  id: string;
  code: string;
  name: string;
  unit: string;
  currencyCode: string;
  salePrice: string;
  isActive: boolean;
};
type SalesOrder = {
  id: string;
  customerId: string;
  orderNumber: string;
  status: "draft" | "confirmed" | "cancelled";
  currencyCode: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
type OrderLine = {
  catalogItemId: string;
  quantity: string;
};

const statusLabels: Record<SalesOrder["status"], string> = {
  draft: "مسودة",
  confirmed: "مؤكد",
  cancelled: "ملغى"
};

export function SalesOrdersPage({ api }: { api: ApiClient }) {
  const limit = 25;
  const [orders, setOrders] = useState<Page<SalesOrder> | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([{ catalogItemId: "", quantity: "1" }]);
  const [creating, setCreating] = useState(false);
  const [transitioning, setTransitioning] = useState<string | null>(null);

  const customerById = useMemo(() => new Map(customers.map((customer) => [customer.id, customer.displayName])), [customers]);
  const currencies = useMemo(() => [...new Set(items.map((item) => item.currencyCode))].sort(), [items]);
  const currencyItems = useMemo(
    () => items.filter((item) => item.currencyCode === currencyCode),
    [items, currencyCode]
  );

  async function loadOrders(nextOffset = offset) {
    setState("loading");
    setError(null);
    try {
      setOrders(await api.get<Page<SalesOrder>>(`sales-orders?limit=${limit}&offset=${nextOffset}`));
      setOffset(nextOffset);
      setState("idle");
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "تعذر تحميل طلبات البيع.");
    }
  }

  async function loadReferences() {
    try {
      const [customerPage, itemPage] = await Promise.all([
        api.get<Page<Customer>>("customers?limit=200&offset=0"),
        api.get<Page<CatalogItem>>("catalog/items?limit=200&offset=0")
      ]);
      setCustomers(customerPage.data);
      setItems(itemPage.data);
      if (!currencyCode && itemPage.data[0]) setCurrencyCode(itemPage.data[0].currencyCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل العملاء والكتالوج.");
    }
  }

  useEffect(() => {
    void loadReferences();
    void loadOrders(0);
  }, []);

  function updateLine(index: number, patch: Partial<OrderLine>) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  }

  function addLine() {
    setLines((current) => [...current, { catalogItemId: "", quantity: "1" }]);
  }

  function removeLine(index: number) {
    setLines((current) => current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index));
  }

  async function createOrder() {
    const selectedLines = lines.filter((line) => line.catalogItemId.trim());
    if (!customerId) return setError("اختر العميل.");
    if (!currencyCode) return setError("لا توجد عملة متاحة في الكتالوج.");
    if (!selectedLines.length) return setError("أضف عنصرًا واحدًا على الأقل.");
    if (selectedLines.some((line) => !/^\d+(\.\d{1,10})?$/.test(line.quantity) || Number(line.quantity) <= 0)) {
      return setError("كل كمية يجب أن تكون رقمًا أكبر من صفر.");
    }

    setCreating(true);
    setError(null);
    try {
      await api.post(
        "sales-orders",
        {
          customerId,
          currencyCode,
          notes: notes.trim() || null,
          lines: selectedLines
        },
        crypto.randomUUID()
      );
      setCustomerId("");
      setNotes("");
      setLines([{ catalogItemId: "", quantity: "1" }]);
      await loadOrders(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إنشاء طلب البيع.");
    } finally {
      setCreating(false);
    }
  }

  async function transition(orderId: string, action: "confirm" | "cancel") {
    setTransitioning(orderId);
    setError(null);
    try {
      await api.post(`sales-orders/${orderId}/${action}`, {}, crypto.randomUUID());
      await loadOrders(offset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحديث طلب البيع.");
    } finally {
      setTransitioning(null);
    }
  }

  return <div className="sales-orders-page">
    <section className="panel">
      <div className="section-heading">
        <div><span className="eyebrow">دورة طلب البيع</span><h2>إنشاء طلب جديد</h2></div>
      </div>
      <div className="form-grid">
        <label>العميل
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">اختر العميل</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName}</option>)}
          </select>
        </label>
        <label>العملة
          <select value={currencyCode} onChange={(e) => {
            setCurrencyCode(e.target.value);
            setLines([{ catalogItemId: "", quantity: "1" }]);
          }}>
            <option value="">اختر العملة</option>
            {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
          </select>
        </label>
      </div>
      <div className="order-lines">
        {lines.map((line, index) => <div className="order-line" key={index}>
          <label>العنصر
            <select value={line.catalogItemId} onChange={(e) => updateLine(index, { catalogItemId: e.target.value })}>
              <option value="">اختر العنصر</option>
              {currencyItems.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name} — {item.salePrice} / {item.unit}</option>)}
            </select>
          </label>
          <label>الكمية
            <input value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} inputMode="decimal" />
          </label>
          <button className="secondary" type="button" onClick={() => removeLine(index)} disabled={lines.length === 1}>حذف</button>
        </div>)}
      </div>
      <div className="form-actions">
        <button className="secondary" type="button" onClick={addLine}>إضافة سطر</button>
        <label className="notes-field">ملاحظات
          <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </label>
        <button type="button" onClick={() => void createOrder()} disabled={creating}>{creating ? "جارٍ الإنشاء…" : "إنشاء طلب البيع"}</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </section>

    <section className="panel">
      <div className="section-heading">
        <div><span className="eyebrow">السجل</span><h2>طلبات البيع</h2></div>
        <button className="secondary" type="button" onClick={() => void loadOrders(offset)} disabled={state === "loading"}>تحديث</button>
      </div>
      {state === "loading" && <p className="muted">جارٍ تحميل الطلبات…</p>}
      {orders && <div className="table-wrap">
        <table>
          <thead><tr><th>الطلب</th><th>العميل</th><th>الحالة</th><th>العملة</th><th>التاريخ</th><th>الإجراء</th></tr></thead>
          <tbody>
            {orders.data.length === 0 ? <tr><td colSpan={6}>لا توجد طلبات.</td></tr> : orders.data.map((order) => <tr key={order.id}>
              <td dir="ltr">{order.orderNumber}</td>
              <td>{customerById.get(order.customerId) || order.customerId}</td>
              <td>{statusLabels[order.status]}</td>
              <td dir="ltr">{order.currencyCode}</td>
              <td dir="ltr">{new Date(order.createdAt).toLocaleString("ar-AE")}</td>
              <td>
                {order.status === "draft" ? <span className="row-actions">
                  <button className="secondary" type="button" disabled={transitioning === order.id} onClick={() => void transition(order.id, "confirm")}>تأكيد</button>
                  <button className="danger" type="button" disabled={transitioning === order.id} onClick={() => void transition(order.id, "cancel")}>إلغاء</button>
                </span> : "—"}
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>}
      {orders && <div className="pager">
        <button className="secondary" type="button" disabled={offset === 0 || state === "loading"} onClick={() => void loadOrders(Math.max(0, offset - limit))}>السابق</button>
        <span>الصفحة {Math.floor(offset / limit) + 1}</span>
        <button className="secondary" type="button" disabled={!orders.meta.hasMore || state === "loading"} onClick={() => void loadOrders(offset + limit)}>التالي</button>
      </div>}
    </section>
  </div>;
}
