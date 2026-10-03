import { useMemo, useState } from "react";
import { ApiClient } from "./api/client";
import { clearSession, getSession, setSession } from "./auth/session";

const modules = [
  ["dashboard", "لوحة التحكم"],
  ["customers", "العملاء"],
  ["sales", "المبيعات"],
  ["invoices", "الفواتير"],
  ["payments", "التحصيل والمدفوعات"],
  ["delivery", "التوصيل"],
  ["accounting", "المحاسبة"]
] as const;

export function App() {
  const [session, setSessionState] = useState(getSession());
  const [active, setActive] = useState<(typeof modules)[number][0]>("dashboard");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const api = useMemo(
    () => new ApiClient(import.meta.env.VITE_API_BASE_URL || "/api/v1/", () => session?.token ?? null),
    [session]
  );

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="brand-mark">HO</div>
          <h1 id="auth-title">HO Network</h1>
          <p>واجهة التشغيل العربية</p>
          <label htmlFor="token">رمز الجلسة</label>
          <input
            id="token"
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoComplete="off"
            dir="ltr"
            placeholder="Bearer token"
          />
          <button
            type="button"
            onClick={() => {
              if (!token.trim()) return setError("أدخل رمز الجلسة.");
              setError(null);
              setSessionState(setSession(token.trim()));
              setToken("");
            }}
          >
            بدء الجلسة
          </button>
          <small>لا يتم تخزين رمز الجلسة في Local Storage أو ملفات تعريف الارتباط.</small>
          {error && <p className="error" role="alert">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <strong>HO Network</strong>
          <span>نظام التشغيل والإدارة</span>
        </div>
        <button className="secondary" type="button" onClick={() => { clearSession(); setSessionState(null); }}>
          إنهاء الجلسة
        </button>
      </header>

      <div className="workspace">
        <nav className="sidebar" aria-label="التنقل الرئيسي">
          {modules.map(([id, label]) => (
            <button
              className={active === id ? "nav-item active" : "nav-item"}
              type="button"
              key={id}
              onClick={() => setActive(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <main className="content">
          <section className="page-heading">
            <div>
              <span className="eyebrow">الوحدة الحالية</span>
              <h1>{modules.find(([id]) => id === active)?.[1]}</h1>
            </div>
            <span className="status">جلسة نشطة</span>
          </section>

          {active === "dashboard" ? (
            <Dashboard api={api} />
          ) : (
            <section className="panel">
              <h2>{modules.find(([id]) => id === active)?.[1]}</h2>
              <p>تم تأسيس مساحة الوحدة. ربط العمليات الفعلية سيُضاف فوق عقد API الحالية دون تخزين بيانات مالية محليًا.</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function Dashboard({ api }: { api: ApiClient }) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("لم يتم الاتصال بالـAPI بعد.");

  async function checkApi() {
    setState("loading");
    try {
      await api.get("customers?limit=1&offset=0");
      setState("ready");
      setMessage("تم الاتصال بالـAPI بنجاح.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "تعذر الاتصال بالـAPI.");
    }
  }

  return (
    <div className="dashboard-grid">
      <section className="panel hero-panel">
        <span className="eyebrow">Foundation / v1</span>
        <h2>مساحة التشغيل الأساسية</h2>
        <p>واجهة RTL قابلة للتوسع فوق API الحالية، مع فصل واضح بين الجلسة، النقل، والوحدات.</p>
        <button type="button" onClick={() => void checkApi()} disabled={state === "loading"}>
          {state === "loading" ? "جارٍ التحقق…" : "اختبار اتصال API"}
        </button>
        <p className={state === "error" ? "error" : state === "ready" ? "success" : "muted"} role="status">{message}</p>
      </section>
      <section className="panel">
        <h2>مبادئ الحماية</h2>
        <ul>
          <li>رمز المصادقة في الذاكرة فقط.</li>
          <li>لا يوجد cache لبيانات API في Service Worker.</li>
          <li>العقود المالية تبقى مصدرها الـAPI وقاعدة البيانات.</li>
          <li>الواجهة لا تتجاوز صلاحيات الخادم.</li>
        </ul>
      </section>
    </div>
  );
}
