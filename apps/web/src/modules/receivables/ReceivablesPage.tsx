import { useEffect, useState } from "react";
import type { ApiClient } from "../../api/client";

type Customer = { id: string; displayName: string };
type Receivable = {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  currencyCode: string;
  totalAmount: string;
  issueDate: string | null;
  dueDate: string | null;
  allocatedAmount: string;
  outstandingAmount: string;
};
type Page<T> = { data: T[]; meta: { limit: number; offset: number; hasMore: boolean } };

export function ReceivablesPage({ api }: { api: ApiClient }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [page, setPage] = useState<Page<Receivable> | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = 25;

  async function load(selectedCustomerId = customerId, nextOffset = offset) {
    if (!selectedCustomerId) { setPage(null); return; }
    setLoading(true); setError(null);
    try {
      const result = await api.get<Page<Receivable>>(
        `receivables/customers/${selectedCustomerId}?limit=${limit}&offset=${nextOffset}`
      );
      setPage(result); setOffset(nextOffset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل الذمم.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    void api.get<Page<Customer>>("customers?limit=200&offset=0")
      .then(result => setCustomers(result.data))
      .catch(e => setError(e instanceof Error ? e.message : "تعذر تحميل العملاء."));
  }, []);

  return <div className="receivables-page">
    <section className="panel">
      <div className="section-heading">
        <div><span className="eyebrow">الحسابات المدينة</span><h2>ذمم العميل</h2></div>
      </div>
      <div className="form-grid">
        <label>العميل
          <select value={customerId} onChange={e => { setCustomerId(e.target.value); setOffset(0); void load(e.target.value, 0); }}>
            <option value="">اختر عميلًا</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.displayName}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => void load()} disabled={!customerId || loading}>
          {loading ? "جارٍ التحميل…" : "تحديث الذمم"}
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
    <section className="panel">
      {!customerId && <p className="muted">اختر عميلًا لعرض الفواتير الصادرة والرصيد المستحق.</p>}
      {loading && <p className="muted">جارٍ تحميل الذمم…</p>}
      {page && <div className="table-wrap"><table><thead><tr>
        <th>الفاتورة</th><th>الإصدار</th><th>الاستحقاق</th><th>الإجمالي</th><th>المخصص</th><th>المتبقي</th>
      </tr></thead><tbody>
        {page.data.length === 0 ? <tr><td colSpan={6}>لا توجد فواتير صادرة.</td></tr> : page.data.map(r =>
          <tr key={r.invoiceId}>
            <td>{r.invoiceNumber}</td><td dir="ltr">{r.issueDate || "—"}</td><td dir="ltr">{r.dueDate || "—"}</td>
            <td dir="ltr">{r.totalAmount} {r.currencyCode}</td><td dir="ltr">{r.allocatedAmount}</td>
            <td dir="ltr"><strong>{r.outstandingAmount}</strong> {r.currencyCode}</td>
          </tr>
        )}
      </tbody></table></div>}
      {page && <div className="pager">
        <button className="secondary" type="button" disabled={offset === 0 || loading} onClick={() => void load(customerId, Math.max(0, offset - limit))}>السابق</button>
        <span>الصفحة {Math.floor(offset / limit) + 1}</span>
        <button className="secondary" type="button" disabled={!page.meta.hasMore || loading} onClick={() => void load(customerId, offset + limit)}>التالي</button>
      </div>}
    </section>
  </div>;
}
