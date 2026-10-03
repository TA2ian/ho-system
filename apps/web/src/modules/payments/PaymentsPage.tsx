import { useEffect, useState } from "react";
import type { ApiClient } from "../../api/client";

type Customer = { id: string; displayName: string };
type Receivable = { invoiceId: string; invoiceNumber: string; currencyCode: string; outstandingAmount: string };
type Payment = {
  id: string; customerId: string; paymentNumber: string; status: "recorded" | "voided";
  amount: string; currencyCode: string; method: "cash" | "sham_cash"; reference: string | null;
  receivedAt: string; notes: string | null;
};
type Page<T> = { data: T[]; meta: { limit: number; offset: number; hasMore: boolean } };
type PaymentResult = { payment: Payment; allocations: { id: string; invoiceId: string; amount: string; currencyCode: string }[] };

export function PaymentsPage({ api }: { api: ApiClient }) {
  const limit = 25;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState("AED");
  const [method, setMethod] = useState<"cash" | "sham_cash">("cash");
  const [reference, setReference] = useState("");
  const [payments, setPayments] = useState<Page<Payment> | null>(null);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [allocationAmount, setAllocationAmount] = useState("");
  const [reason, setReason] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPayments(nextOffset = offset) {
    setLoading(true); setError(null);
    try { setPayments(await api.get<Page<Payment>>(`payments?limit=${limit}&offset=${nextOffset}`)); setOffset(nextOffset); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر تحميل المدفوعات."); }
    finally { setLoading(false); }
  }

  async function loadReceivables(nextCustomerId = customerId) {
    if (!nextCustomerId) { setReceivables([]); return; }
    try {
      const result = await api.get<Page<Receivable>>(`receivables/customers/${nextCustomerId}?limit=200&offset=0`);
      setReceivables(result.data);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تحميل الذمم."); }
  }

  useEffect(() => {
    void api.get<Page<Customer>>("customers?limit=200&offset=0").then(r => setCustomers(r.data))
      .catch(e => setError(e instanceof Error ? e.message : "تعذر تحميل العملاء."));
    void loadPayments(0);
  }, []);

  async function create() {
    if (!customerId || !amount.trim()) return setError("اختر العميل وأدخل مبلغ الدفعة.");
    setSaving(true); setError(null); setMessage(null);
    try {
      const result = await api.post<PaymentResult>("payments", {
        customerId, amount: amount.trim(), currencyCode, method,
        reference: reference.trim() || null, receivedAt: undefined, notes: null
      }, crypto.randomUUID());
      setSelectedPaymentId(result.payment.id); setAmount(""); setReference("");
      setMessage(`تم تسجيل الدفعة ${result.payment.paymentNumber}.`);
      await loadPayments(0);
      await loadReceivables(customerId);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تسجيل الدفعة."); }
    finally { setSaving(false); }
  }

  async function allocate() {
    if (!selectedPaymentId || !invoiceId || !allocationAmount.trim()) return setError("اختر دفعة وفاتورة وأدخل مبلغ التخصيص.");
    setSaving(true); setError(null); setMessage(null);
    try {
      const result = await api.post<PaymentResult & { invoiceOutstanding: string }>(
        `payments/${selectedPaymentId}/allocate`,
        { invoiceId, amount: allocationAmount.trim() }, crypto.randomUUID()
      );
      setAllocationAmount(""); setMessage(`تم تخصيص الدفعة. المتبقي على الفاتورة: ${result.invoiceOutstanding}.`);
      await loadReceivables(customerId);
      await loadPayments(offset);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تخصيص الدفعة."); }
    finally { setSaving(false); }
  }

  async function reverse() {
    if (!selectedPaymentId || reason.trim().length < 3) return setError("اختر دفعة وأدخل سبب العكس.");
    setSaving(true); setError(null); setMessage(null);
    try {
      await api.post<PaymentResult>(`payments/${selectedPaymentId}/reverse`, { reason: reason.trim() }, crypto.randomUUID());
      setReason(""); setMessage("تم عكس الدفعة وعكس تخصيصاتها المالية.");
      await loadPayments(offset);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر عكس الدفعة."); }
    finally { setSaving(false); }
  }

  return <div className="payments-page">
    <section className="panel">
      <div className="section-heading"><div><span className="eyebrow">التحصيل</span><h2>تسجيل دفعة</h2></div></div>
      <div className="form-grid">
        <label>العميل<select value={customerId} onChange={e => { setCustomerId(e.target.value); setSelectedPaymentId(""); void loadReceivables(e.target.value); }}>
          <option value="">اختر عميلًا</option>{customers.map(c => <option key={c.id} value={c.id}>{c.displayName}</option>)}
        </select></label>
        <label>المبلغ<input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" dir="ltr" /></label>
        <label>العملة<input value={currencyCode} onChange={e => setCurrencyCode(e.target.value.toUpperCase())} maxLength={3} dir="ltr" /></label>
        <label>طريقة الدفع<select value={method} onChange={e => setMethod(e.target.value as typeof method)}><option value="cash">نقدي</option><option value="sham_cash">Sham Cash</option></select></label>
        <label>المرجع<input value={reference} onChange={e => setReference(e.target.value)} maxLength={255} /></label>
        <button type="button" onClick={() => void create()} disabled={saving}>{saving ? "جارٍ الحفظ…" : "تسجيل الدفعة"}</button>
      </div>
      <p className="muted">تسجيل الدفعة ينشئ القيد المالي على الخادم؛ لا تُحسب الأرصدة محليًا.</p>
    </section>

    <section className="panel">
      <div className="section-heading"><div><span className="eyebrow">التخصيص</span><h2>تخصيص دفعة إلى فاتورة</h2></div></div>
      <div className="form-grid">
        <label>الدفعة<select value={selectedPaymentId} onChange={e => setSelectedPaymentId(e.target.value)}>
          <option value="">اختر دفعة</option>{payments?.data.filter(p => p.status === "recorded").map(p => <option key={p.id} value={p.id}>{p.paymentNumber} — {p.amount} {p.currencyCode}</option>)}
        </select></label>
        <label>الفاتورة<select value={invoiceId} onChange={e => setInvoiceId(e.target.value)}>
          <option value="">اختر فاتورة</option>{receivables.filter(r => r.outstandingAmount !== "0").map(r => <option key={r.invoiceId} value={r.invoiceId}>{r.invoiceNumber} — {r.outstandingAmount} {r.currencyCode}</option>)}
        </select></label>
        <label>مبلغ التخصيص<input inputMode="decimal" value={allocationAmount} onChange={e => setAllocationAmount(e.target.value)} dir="ltr" placeholder="0.00" /></label>
        <button type="button" onClick={() => void allocate()} disabled={saving}>تخصيص الدفعة</button>
      </div>
    </section>

    <section className="panel">
      <div className="section-heading"><div><span className="eyebrow">سجل المدفوعات</span><h2>المدفوعات</h2></div><button className="secondary" type="button" onClick={() => void loadPayments(offset)} disabled={loading}>تحديث</button></div>
      {loading && <p className="muted">جارٍ تحميل المدفوعات…</p>}
      {payments && <div className="table-wrap"><table><thead><tr><th>الرقم</th><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>
        {payments.data.length === 0 ? <tr><td colSpan={6}>لا توجد مدفوعات.</td></tr> : payments.data.map(p => <tr key={p.id}>
          <td>{p.paymentNumber}</td><td dir="ltr">{new Date(p.receivedAt).toLocaleString("ar-AE")}</td><td dir="ltr">{p.amount} {p.currencyCode}</td>
          <td>{p.method === "cash" ? "نقدي" : "Sham Cash"}</td><td>{p.status === "recorded" ? "مسجلة" : "معكوسة"}</td>
          <td><button className="secondary" type="button" disabled={saving || p.status !== "recorded"} onClick={() => { setSelectedPaymentId(p.id); setCustomerId(p.customerId); void loadReceivables(p.customerId); }}>اختيار</button></td>
        </tr>)}
      </tbody></table></div>}
      {payments && <div className="pager"><button className="secondary" type="button" disabled={offset === 0 || loading} onClick={() => void loadPayments(Math.max(0, offset - limit))}>السابق</button><span>الصفحة {Math.floor(offset / limit) + 1}</span><button className="secondary" type="button" disabled={!payments.meta.hasMore || loading} onClick={() => void loadPayments(offset + limit)}>التالي</button></div>}
    </section>

    <section className="panel">
      <div className="section-heading"><div><span className="eyebrow">تصحيح مالي</span><h2>عكس الدفعة</h2></div></div>
      <div className="form-actions"><label className="notes-field">سبب العكس<input value={reason} onChange={e => setReason(e.target.value)} maxLength={500} /></label><button className="danger" type="button" disabled={saving || !selectedPaymentId} onClick={() => void reverse()}>عكس الدفعة</button></div>
    </section>
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}
  </div>;
}
