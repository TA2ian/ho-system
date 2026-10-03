import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiClient } from "../../api/client";
import { DataTable, type Column } from "../../components/common/DataTable";
import { Pagination } from "../../components/common/Pagination";
import { StatusBadge } from "../../components/common/StatusBadge";
import { FeedbackState } from "../../components/common/FeedbackState";
import { ResponsiveCardList } from "../../components/common/ResponsiveCardList";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";

type CampaignStatus = "draft" | "planned" | "active" | "paused" | "completed" | "cancelled";
export interface Campaign {
  id: string; campaignNumber: string; customerId: string; partnerUserId: string | null;
  name: string; status: CampaignStatus; currencyCode: string; grossAmount: string;
  plannedAdSpend: string; managementFeeAmount: string; partnerSharePercent: string;
  startsOn: string | null; endsOn: string | null; notes: string | null;
  createdAt: string; updatedAt: string;
}
interface Page<T> { data: T[]; meta: { limit: number; offset: number; hasMore: boolean } }
interface Customer { id: string; displayName: string; status: string }
interface User { id: string; displayName?: string; email?: string; status?: string }
interface CampaignDetail {
  campaign: Campaign;
  spend: Array<{ id: string; amount: string; currencyCode: string; spentAt: string; reference: string | null; notes: string | null; reversed: boolean }>;
  invoices: Array<{ id: string; invoiceId: string; createdAt: string }>;
  financialSnapshot: { spendTotal: string; estimatedProfit: string; estimatedPartnerShare: string };
}

const statusLabel: Record<CampaignStatus, string> = {
  draft: "مسودة", planned: "مخططة", active: "نشطة", paused: "متوقفة", completed: "مكتملة", cancelled: "ملغاة"
};

function key() { return crypto.randomUUID(); }

export const CampaignsPage: React.FC<{ api: ApiClient }> = ({ api }) => {
  const limit = 25;
  const [page, setPage] = useState<Page<Campaign> | null>(null);
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState<"idle"|"loading"|"error">("idle");
  const [error, setError] = useState<string|null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CampaignStatus|"all">("all");
  const [selected, setSelected] = useState<CampaignDetail|null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [action, setAction] = useState<{campaign: Campaign; next: CampaignStatus}|null>(null);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<string|null>(null);
  const [actionError, setActionError] = useState<string|null>(null);

  const customerById = useMemo(() => new Map(customers.map(c => [c.id, c.displayName])), [customers]);

  const load = useCallback(async (target: number) => {
    setState("loading"); setError(null);
    try { const res = await api.get<Page<Campaign>>(`campaigns?limit=${limit}&offset=${target}`); setPage(res); setOffset(target); setState("idle"); }
    catch (e) { setState("error"); setError(e instanceof Error ? e.message : "تعذر تحميل الحملات."); }
  }, [api]);
  const loadCustomers = useCallback(async () => {
    try { const res = await api.get<Page<Customer>>("customers?limit=200&offset=0"); setCustomers(res.data); } catch {}
  }, [api]);
  useEffect(() => { void load(0); void loadCustomers(); }, [load, loadCustomers]);

  const filtered = useMemo(() => (page?.data ?? []).filter(c => {
    const q=search.trim().toLowerCase();
    return (!q || c.campaignNumber.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || (customerById.get(c.customerId)||"").toLowerCase().includes(q))
      && (status==="all" || c.status===status);
  }), [page?.data, search, status, customerById]);

  const refresh = async () => { await load(offset); };
  const transition = async () => {
    if (!action) return; setProcessing(true); setActionError(null);
    try {
      await api.post(`campaigns/${action.campaign.id}/status`, { status: action.next }, key());
      setToast(`تم تغيير حالة الحملة إلى ${statusLabel[action.next]}.`); setAction(null); await refresh();
    } catch(e) { setActionError(e instanceof Error ? e.message : "تعذر تنفيذ الانتقال."); }
    finally { setProcessing(false); }
  };

  const columns: Column<Campaign>[] = [
    { key:"campaignNumber", header:"رقم الحملة", dir:"ltr", render:c=><strong>{c.campaignNumber}</strong> },
    { key:"name", header:"الحملة", render:c=><span>{c.name}</span> },
    { key:"customerId", header:"العميل", render:c=><span>{customerById.get(c.customerId) || c.customerId}</span> },
    { key:"status", header:"الحالة", render:c=><StatusBadge status={c.status} label={statusLabel[c.status]} /> },
    { key:"currencyCode", header:"العملة", dir:"ltr", render:c=><code>{c.currencyCode}</code> },
    { key:"plannedAdSpend", header:"الإنفاق المخطط", dir:"ltr", render:c=><span>{c.plannedAdSpend} {c.currencyCode}</span> },
    { key:"id", header:"الإجراءات", render:c=><div style={{display:"flex",gap:".4rem",flexWrap:"wrap"}}>
      <button className="ho-btn ho-btn-secondary ho-btn-sm" onClick={()=>void openDetail(c)}>التفاصيل</button>
      {nextStatus(c.status) && <button className="ho-btn ho-btn-primary ho-btn-sm" onClick={()=>setAction({campaign:c,next:nextStatus(c.status)!})}>{statusLabel[nextStatus(c.status)!]}</button>}
    </div> }
  ];

  async function openDetail(c: Campaign) {
    try { setSelected(await api.get<CampaignDetail>(`campaigns/${c.id}`)); }
    catch(e) { setActionError(e instanceof Error ? e.message : "تعذر تحميل تفاصيل الحملة."); }
  }

  function nextStatus(s: CampaignStatus): CampaignStatus|null {
    if(s==="draft") return "planned"; if(s==="planned") return "active"; if(s==="active") return "paused"; if(s==="paused") return "active"; return null;
  }

  return <div>
    {toast && <div className="ho-alert ho-alert-success" role="status" style={{marginBottom:"1rem"}}>{toast}</div>}
    {actionError && <div className="ho-alert ho-alert-danger" role="alert" style={{marginBottom:"1rem"}}>{actionError}</div>}
    <header className="ho-page-header">
      <div><h1 className="ho-page-header-title">الحملات الإعلانية</h1><p className="ho-page-header-desc">إدارة الحملات، الإنفاق، الشركاء، وربط الفواتير دون إنشاء بيانات محلية وهمية.</p></div>
      <div className="ho-page-header-actions"><button className="ho-btn ho-btn-secondary" onClick={()=>void refresh()} disabled={state==="loading"}>تحديث</button><button className="ho-btn ho-btn-primary" onClick={()=>setCreateOpen(true)}>+ إنشاء حملة</button></div>
    </header>
    <section className="panel">
      {state==="loading" && !page ? <FeedbackState mode="loading" title="جارٍ تحميل الحملات..." /> :
       state==="error" && !page ? <FeedbackState mode="error" title="تعذر تحميل الحملات" message={error||undefined} onRetry={()=>void load(offset)} /> :
       page?.data.length===0 ? <FeedbackState mode="empty" title="لا توجد حملات" message="أنشئ أول حملة من زر إنشاء حملة." onAction={()=>setCreateOpen(true)} actionLabel="إنشاء حملة" /> :
       <>
        <div className="ho-toolbar" role="search"><input className="ho-input ho-input-sm" type="search" placeholder="بحث برقم الحملة أو الاسم أو العميل..." value={search} onChange={e=>setSearch(e.target.value)} /><select className="ho-select ho-select-sm" value={status} onChange={e=>setStatus(e.target.value as CampaignStatus|"all")}><option value="all">كل الحالات</option>{Object.entries(statusLabel).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
        <div className="ho-desktop-only"><DataTable data={filtered} columns={columns} keyExtractor={c=>c.id} caption="جدول الحملات" /></div>
        <div className="ho-mobile-only"><ResponsiveCardList items={filtered} keyExtractor={c=>c.id} renderCard={c=><div className="ho-customer-card"><div className="ho-customer-card-header"><div><strong dir="ltr">{c.campaignNumber}</strong><div>{c.name}</div></div><StatusBadge status={c.status} label={statusLabel[c.status]} /></div><div className="ho-customer-card-details"><div className="ho-customer-card-row"><span>العميل:</span><span>{customerById.get(c.customerId)||c.customerId}</span></div><div className="ho-customer-card-row"><span>المخطط:</span><span dir="ltr">{c.plannedAdSpend} {c.currencyCode}</span></div></div><button className="ho-btn ho-btn-secondary" style={{width:"100%"}} onClick={()=>void openDetail(c)}>التفاصيل</button></div>} /></div>
        <Pagination offset={offset} limit={limit} hasMore={page!.meta.hasMore} onPageChange={o=>void load(o)} disabled={state==="loading"} />
       </>}
    </section>
    <CreateCampaignDialog api={api} open={createOpen} customers={customers} onClose={()=>setCreateOpen(false)} onSuccess={()=>{setCreateOpen(false);setToast("تم إنشاء الحملة.");void refresh();}} />
    {selected && <CampaignDetailDialog api={api} detail={selected} onClose={()=>setSelected(null)} onChanged={async()=>{setSelected(await api.get<CampaignDetail>(`campaigns/${selected.campaign.id}`));await refresh();}} />}
    {action && <ConfirmDialog isOpen title={`تغيير حالة الحملة إلى ${statusLabel[action.next]}`} description={`سيتم نقل الحملة ${action.campaign.campaignNumber} من ${statusLabel[action.campaign.status]} إلى ${statusLabel[action.next]} وفق دورة الحياة المعتمدة.`} confirmLabel="تنفيذ الانتقال" cancelLabel="تراجع" isProcessing={processing} onConfirm={()=>void transition()} onCancel={()=>{if(!processing)setAction(null)}} />}
  </div>;
};

function CreateCampaignDialog({api,open,customers,onClose,onSuccess}:{api:ApiClient;open:boolean;customers:Customer[];onClose:()=>void;onSuccess:()=>void}) {
  const [v,setV]=useState({customerId:"",name:"",currencyCode:"AED",grossAmount:"0",plannedAdSpend:"0",managementFeeAmount:"0",partnerSharePercent:"0",startsOn:"",endsOn:"",notes:"",partnerUserId:""});
  const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null);
  if(!open)return null;
  const amount=/^\d+(\.\d{1,10})?$/; const percent=/^\d+(\.\d{1,4})?$/;
  const valid=v.customerId&&v.name.trim()&&amount.test(v.grossAmount)&&amount.test(v.plannedAdSpend)&&amount.test(v.managementFeeAmount)&&percent.test(v.partnerSharePercent)&&Number(v.partnerSharePercent)<=100;
  async function submit(e:React.FormEvent){e.preventDefault();if(!valid||busy)return;setBusy(true);setError(null);try{await api.post("campaigns",{customerId:v.customerId,name:v.name.trim(),currencyCode:v.currencyCode.trim().toUpperCase(),grossAmount:v.grossAmount,plannedAdSpend:v.plannedAdSpend,managementFeeAmount:v.managementFeeAmount,partnerSharePercent:v.partnerSharePercent,startsOn:v.startsOn||null,endsOn:v.endsOn||null,notes:v.notes||null,partnerUserId:v.partnerUserId||null},key());onSuccess();}catch(e){setError(e instanceof Error?e.message:"تعذر إنشاء الحملة.");}finally{setBusy(false)}}
  return <div className="ho-dialog-backdrop" role="presentation"><div className="ho-dialog ho-dialog-lg" role="dialog" aria-modal="true" aria-labelledby="campaign-create-title"><form onSubmit={submit}><div className="ho-dialog-header"><div><h2 id="campaign-create-title">إنشاء حملة</h2><p className="ho-dialog-description">الحملة تُنشأ بحالة مسودة ولا تُنشئ قيدًا محاسبيًا.</p></div><button type="button" className="ho-dialog-close-btn" onClick={onClose} disabled={busy}>✕</button></div><div className="ho-dialog-body">{error&&<div className="ho-alert ho-alert-danger" role="alert">{error}</div>}<div className="ho-form-grid">
  <label className="ho-form-field"><span className="ho-label">العميل *</span><select className="ho-select" value={v.customerId} onChange={e=>setV({...v,customerId:e.target.value})}><option value="">اختر العميل</option>{customers.map(c=><option key={c.id} value={c.id}>{c.displayName}</option>)}</select></label>
  <label className="ho-form-field"><span className="ho-label">اسم الحملة *</span><input className="ho-input" value={v.name} onChange={e=>setV({...v,name:e.target.value})} maxLength={255}/></label>
  <label className="ho-form-field"><span className="ho-label">العملة *</span><input className="ho-input" dir="ltr" value={v.currencyCode} onChange={e=>setV({...v,currencyCode:e.target.value})} maxLength={3}/></label>
  <label className="ho-form-field"><span className="ho-label">القيمة الإجمالية *</span><input className="ho-input" dir="ltr" inputMode="decimal" value={v.grossAmount} onChange={e=>setV({...v,grossAmount:e.target.value})}/></label>
  <label className="ho-form-field"><span className="ho-label">الإنفاق المخطط *</span><input className="ho-input" dir="ltr" inputMode="decimal" value={v.plannedAdSpend} onChange={e=>setV({...v,plannedAdSpend:e.target.value})}/></label>
  <label className="ho-form-field"><span className="ho-label">رسوم الإدارة *</span><input className="ho-input" dir="ltr" inputMode="decimal" value={v.managementFeeAmount} onChange={e=>setV({...v,managementFeeAmount:e.target.value})}/></label>
  <label className="ho-form-field"><span className="ho-label">حصة الشريك % *</span><input className="ho-input" dir="ltr" inputMode="decimal" value={v.partnerSharePercent} onChange={e=>setV({...v,partnerSharePercent:e.target.value})}/></label>
  <label className="ho-form-field"><span className="ho-label">بداية الحملة</span><input className="ho-input" type="date" value={v.startsOn} onChange={e=>setV({...v,startsOn:e.target.value})}/></label>
  <label className="ho-form-field"><span className="ho-label">نهاية الحملة</span><input className="ho-input" type="date" value={v.endsOn} onChange={e=>setV({...v,endsOn:e.target.value})}/></label>
  <label className="ho-form-field" style={{gridColumn:"1/-1"}}><span className="ho-label">ملاحظات</span><textarea className="ho-textarea" value={v.notes} onChange={e=>setV({...v,notes:e.target.value})} maxLength={2000}/></label>
 </div></div><div className="ho-dialog-footer"><button type="button" className="ho-btn ho-btn-secondary" onClick={onClose}>إلغاء</button><button className="ho-btn ho-btn-primary" disabled={!valid||busy}>{busy?"جارٍ الإنشاء...":"إنشاء الحملة"}</button></div></form></div></div>;
}

function CampaignDetailDialog({api,detail,onClose,onChanged}:{api:ApiClient;detail:CampaignDetail;onClose:()=>void;onChanged:()=>Promise<void>}) {
 const [busy,setBusy]=useState(false); const [spendAmount,setSpendAmount]=useState(""); const [spendCurrency,setSpendCurrency]=useState(detail.campaign.currencyCode); const [spendRef,setSpendRef]=useState(""); const [spendNotes,setSpendNotes]=useState(""); const [reverse,setReverse]=useState<{id:string}|null>(null); const [reverseReason,setReverseReason]=useState(""); const [error,setError]=useState<string|null>(null);
 async function addSpend(e:React.FormEvent){e.preventDefault();if(busy||!/^[1-9]\d*(\.\d{1,10})?$/.test(spendAmount))return;setBusy(true);try{await api.post(`campaigns/${detail.campaign.id}/spend`,{amount:spendAmount,currencyCode:spendCurrency,reference:spendRef||null,notes:spendNotes||null},key());setSpendAmount("");setSpendRef("");setSpendNotes("");await onChanged();}catch(e){setError(e instanceof Error?e.message:"تعذر تسجيل الإنفاق.");}finally{setBusy(false)}}
 async function doReverse(){if(!reverse||!reverseReason.trim()||busy)return;setBusy(true);try{await api.post(`campaigns/${detail.campaign.id}/spend/${reverse.id}/reverse`,{reason:reverseReason.trim()},key());setReverse(null);setReverseReason("");await onChanged();}catch(e){setError(e instanceof Error?e.message:"تعذر عكس الإنفاق.");}finally{setBusy(false)}}
 return <div className="ho-dialog-backdrop" role="presentation"><div className="ho-dialog ho-dialog-lg" role="dialog" aria-modal="true"><div className="ho-dialog-header"><div><h2>{detail.campaign.name}</h2><p dir="ltr">{detail.campaign.campaignNumber}</p></div><button className="ho-dialog-close-btn" onClick={onClose}>✕</button></div><div className="ho-dialog-body">
 {error&&<div className="ho-alert ho-alert-danger" role="alert">{error}</div>}
 <div className="ho-form-grid"><div><strong>الإنفاق الفعلي</strong><div dir="ltr">{detail.financialSnapshot.spendTotal} {detail.campaign.currencyCode}</div></div><div><strong>الربح التقديري</strong><div dir="ltr">{detail.financialSnapshot.estimatedProfit} {detail.campaign.currencyCode}</div></div><div><strong>حصة الشريك التقديرية</strong><div dir="ltr">{detail.financialSnapshot.estimatedPartnerShare} {detail.campaign.currencyCode}</div></div></div>
 <hr/>
 <h3>تسجيل إنفاق</h3><form onSubmit={addSpend} className="ho-form-grid"><input className="ho-input" dir="ltr" placeholder="المبلغ" value={spendAmount} onChange={e=>setSpendAmount(e.target.value)}/><input className="ho-input" dir="ltr" maxLength={3} value={spendCurrency} onChange={e=>setSpendCurrency(e.target.value.toUpperCase())}/><input className="ho-input" placeholder="مرجع" maxLength={255} value={spendRef} onChange={e=>setSpendRef(e.target.value)}/><input className="ho-input" placeholder="ملاحظات" maxLength={2000} value={spendNotes} onChange={e=>setSpendNotes(e.target.value)}/><button className="ho-btn ho-btn-primary" disabled={busy}>تسجيل الإنفاق</button></form>
 <h3>سجل الإنفاق</h3>{detail.spend.length===0?<p className="muted">لا يوجد إنفاق مسجل.</p>:<div>{detail.spend.map(s=><div key={s.id} className="ho-customer-card" style={{marginBottom:".5rem"}}><div className="ho-customer-card-header"><span dir="ltr">{s.amount} {s.currencyCode}</span>{s.reversed?<StatusBadge status="cancelled" label="معكوس"/>:<button className="ho-btn ho-btn-danger ho-btn-sm" onClick={()=>setReverse({id:s.id})}>عكس الإنفاق</button>}</div><div className="muted">{s.reference||"بدون مرجع"} · {new Date(s.spentAt).toLocaleString("ar-EG")}</div></div>)}</div>}
 {reverse&&<div className="ho-alert" style={{marginTop:"1rem"}}><label className="ho-form-field"><span className="ho-label">سبب العكس *</span><textarea className="ho-textarea" value={reverseReason} onChange={e=>setReverseReason(e.target.value)} maxLength={1000}/></label><button className="ho-btn ho-btn-danger" disabled={busy||!reverseReason.trim()} onClick={()=>void doReverse()}>تأكيد عكس الإنفاق</button><button className="ho-btn ho-btn-secondary" onClick={()=>setReverse(null)}>تراجع</button></div>}
 </div></div></div>;
}
