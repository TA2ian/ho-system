import { useEffect, useState } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleAuthProvider } from './lib/firebase.ts';
import { usePWAInstall } from './lib/usePWAInstall.ts';
import { useOnlineStatus } from './lib/useOnlineStatus.ts';
import {
  Users,
  User,
  ShoppingBag,
  FileText,
  CreditCard,
  LogOut,
  Plus,
  Check,
  X,
  Settings,
  AlertCircle,
  Clock,
  Search,
  Database,
  ArrowLeft,
  UserCheck,
} from 'lucide-react';

// واجهات البيانات المتوافقة مع قاعدة البيانات
interface DBUser {
  id: number;
  uid: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
}

interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: string; // LEAD, ACTIVE, INACTIVE, ARCHIVED
  createdAt: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  description: string | null;
  category: string | null;
  type: string; // PRODUCT, SERVICE, MEDIA_BUYING, DELIVERY
  price: string;
  cost: string;
  status: string;
}

interface SalesOrderItem {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: string;
  totalAmount: string;
  product?: Product;
}

interface SalesOrder {
  id: number;
  customerId: number;
  orderNumber: string;
  status: string; // DRAFT, CONFIRMED, PARTIALLY_FULFILLED, FULFILLED, CANCELLED
  totalAmount: string;
  notes: string | null;
  createdAt: string;
  customer?: Customer;
  items?: SalesOrderItem[];
}

interface InvoiceItem {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: string;
  totalAmount: string;
  product?: Product;
}

interface Invoice {
  id: number;
  salesOrderId: number | null;
  customerId: number;
  invoiceNumber: string;
  status: string; // DRAFT, ISSUED, PARTIALLY_PAID, PAID, VOID
  totalAmount: string;
  dueDate: string | null;
  issuedAt: string | null;
  createdAt: string;
  customer?: Customer;
  items?: InvoiceItem[];
}

interface Receivable {
  id: number;
  customerId: number;
  invoiceId: number;
  status: string; // OPEN, PARTIALLY_PAID, PAID, WRITTEN_OFF
  totalAmount: string;
  remainingAmount: string;
  createdAt: string;
  customer?: Customer;
  invoice?: Invoice;
}

interface AuditLog {
  id: number;
  actorUid: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeState: string | null;
  afterState: string | null;
  timestamp: string;
}

export default function App() {
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [dbUser, setDbUser] = useState<DBUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // تبويبات التنقل الافتراضية للنسخة العربية
  const [activeTab, setActiveTab] = useState<'crm' | 'catalog' | 'sales' | 'invoices' | 'receivables' | 'system'>('crm');

  // قوائم البيانات الأساسية من PostgreSQL
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [systemUsers, setSystemUsers] = useState<DBUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // فلترة البحث
  const [searchQuery, setSearchQuery] = useState('');

  // مؤشرات التحميل والاتصال
  const [dataError, setDataError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // التحكم في النوافذ المنبثقة للنماذج
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    status: 'LEAD',
  });

  const [showProductModal, setShowProductModal] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    description: '',
    category: '',
    type: 'PRODUCT',
    price: '0.00',
    cost: '0.00',
  });

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [orderItems, setOrderItems] = useState<{ productId: string; quantity: number }[]>([
    { productId: '', quantity: 1 }
  ]);
  const [orderNotes, setOrderNotes] = useState('');

  // تهيئة وتثبيت الـ PWA
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const isOnline = useOnlineStatus();

  // مراقبة تغيير حالة الجلسة للمستخدم
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFbUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          const response = await fetch('/api/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const data = await response.json();
            setDbUser(data.dbUser);
          } else {
            setDbUser(null);
          }
        } catch (err) {
          console.error('خطأ في جلب بيانات المستخدم من الخادم:', err);
        }
      } else {
        setDbUser(null);
      }
      setLoadingAuth(false);
    });
    return unsubscribe;
  }, []);

  // جلب كافة السجلات التشغيلية والمالية من الخادم بشكل موحد
  const fetchTabAndCoreData = async () => {
    if (!fbUser) return;
    setLoadingData(true);
    setDataError(null);
    try {
      const token = await fbUser.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      const custRes = await fetch('/api/customers', { headers });
      if (custRes.ok) setCustomers(await custRes.json());

      const prodRes = await fetch('/api/products', { headers });
      if (prodRes.ok) setProducts(await prodRes.json());

      const orderRes = await fetch('/api/sales-orders', { headers });
      if (orderRes.ok) setSalesOrders(await orderRes.json());

      const invRes = await fetch('/api/invoices', { headers });
      if (invRes.ok) setInvoices(await invRes.json());

      const recRes = await fetch('/api/receivables', { headers });
      if (recRes.ok) setReceivables(await recRes.json());

      if (dbUser?.role === 'SUPER_ADMIN' || dbUser?.role === 'ADMIN') {
        const usersRes = await fetch('/api/users', { headers });
        if (usersRes.ok) setSystemUsers(await usersRes.json());

        const auditRes = await fetch('/api/audit-logs', { headers });
        if (auditRes.ok) setAuditLogs(await auditRes.json());
      }
    } catch (err: any) {
      setDataError('انقطع الاتصال بالشبكة. تعذر تحديث السجلات المالية الحالية.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (fbUser && dbUser) {
      fetchTabAndCoreData();
    }
  }, [fbUser, dbUser, activeTab]);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      console.error('خطأ في تسجيل الدخول:', err);
      setDataError(err.message || 'تعذر تسجيل الدخول من خلال حساب Google.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error('خطأ في تسجيل الخروج:', err);
    }
  };

  const showNotification = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => {
      setActionSuccessMsg(null);
    }, 6000);
  };

  // معالجة حساب العميل (حفظ أو تعديل)
  const saveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbUser) return;
    try {
      const token = await fbUser.getIdToken();
      const isEdit = !!editingCustomer;
      const url = isEdit ? `/api/customers/${editingCustomer.id}` : '/api/customers';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(customerForm),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'فشلت عملية حفظ العميل');
      }

      showNotification(isEdit ? 'تم تحديث البيانات الشخصية للعميل بنجاح.' : 'تم تسجيل العميل الجديد بنجاح في قاعدة البيانات.');
      setShowCustomerModal(false);
      setEditingCustomer(null);
      setCustomerForm({ name: '', email: '', phone: '', address: '', notes: '', status: 'LEAD' });
      fetchTabAndCoreData();
    } catch (err: any) {
      setDataError(err.message);
    }
  };

  // معالجة تعريف المنتجات
  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbUser) return;
    try {
      const token = await fbUser.getIdToken();
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(productForm),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'تعذر إدراج المنتج في الكتالوج');
      }

      showNotification(`تم إدراج العنصر '${productForm.name}' بنجاح في كتالوج الخدمات.`);
      setShowProductModal(false);
      setProductForm({ name: '', sku: '', description: '', category: '', type: 'PRODUCT', price: '0.00', cost: '0.00' });
      fetchTabAndCoreData();
    } catch (err: any) {
      setDataError(err.message);
    }
  };

  // معالجة تسجيل مسودة طلب مبيعات جديد
  const saveSalesOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbUser) return;
    if (!selectedCustomerId) {
      setDataError('يرجى تحديد العميل أولاً لإتمام طلب المبيعات.');
      return;
    }
    const cleanItems = orderItems.filter((i) => i.productId !== '');
    if (cleanItems.length === 0) {
      setDataError('يرجى إدراج بند واحد صالح على الأقل من الكتالوج.');
      return;
    }

    try {
      const token = await fbUser.getIdToken();
      const res = await fetch('/api/sales-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          items: cleanItems,
          notes: orderNotes,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'تعذر إتمام تسجيل مستند المبيعات');
      }

      showNotification('تم تسجيل مستند المبيعات الجديد كمسودة (DRAFT) بنجاح.');
      setShowOrderModal(false);
      setSelectedCustomerId('');
      setOrderItems([{ productId: '', quantity: 1 }]);
      setOrderNotes('');
      fetchTabAndCoreData();
    } catch (err: any) {
      setDataError(err.message);
    }
  };

  // تأكيد مستند المبيعات لإصدار الفواتير والمستحقات تلقائياً
  const confirmOrder = async (orderId: number) => {
    if (!fbUser) return;
    try {
      const token = await fbUser.getIdToken();
      const res = await fetch(`/api/sales-orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'CONFIRMED' }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'تعذر تأكيد طلب المبيعات');
      }

      showNotification('تم تأكيد طلب المبيعات بنجاح! تم تلقائياً إصدار الفاتورة وتوليد قيد مستحقات مدخرة في دفتر الأستاذ.');
      fetchTabAndCoreData();
    } catch (err: any) {
      setDataError(err.message);
    }
  };

  // تعديل رتبة المستخدم في النظام (للمسؤولين فقط)
  const changeUserRole = async (uid: string, role: string) => {
    if (!fbUser) return;
    try {
      const token = await fbUser.getIdToken();
      const res = await fetch(`/api/users/${uid}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'تعذر تغيير رتبة المستخدم');
      }

      showNotification('تم تحديث رتبة الصلاحية للمستخدم بنجاح.');
      fetchTabAndCoreData();
    } catch (err: any) {
      setDataError(err.message);
    }
  };

  // منطق الفلترة والبحث للغة العربية
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.phone && c.phone.includes(searchQuery))
  );

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOrders = salesOrders.filter(o =>
    o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (o.customer?.name && o.customer.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredInvoices = invoices.filter(i =>
    i.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (i.customer?.name && i.customer.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredReceivables = receivables.filter(r =>
    (r.customer?.name && r.customer.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (r.invoice?.invoiceNumber && r.invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white font-sans">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm text-slate-400 tracking-wide">جاري تحميل نظام HO المحاسبي التشغيلي...</p>
        </div>
      </div>
    );
  }

  // صفحة تسجيل الدخول بالكامل باللغة العربية
  if (!fbUser || !dbUser) {
    return (
      <div className="flex min-h-screen flex-col justify-center bg-slate-950 px-6 py-12 lg:px-8 text-white font-sans relative overflow-hidden">
        {/* خلفية هندسية ناعمة */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />
        
        <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 text-center">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Database className="h-9 w-9 text-slate-950" />
            </div>
          </div>
          <h2 className="mt-8 text-3xl font-bold tracking-tight text-white font-display">
            دفتر حسابات شبكة HO
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            نظام موحد لإدارة علاقات العملاء، عروض المبيعات، الفواتير والحسابات المدينة
          </p>
        </div>

        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md z-10">
          <div className="bg-slate-900 border border-slate-800 px-8 py-10 rounded-3xl shadow-xl shadow-slate-950/50">
            {dataError && (
              <div className="mb-6 rounded-xl bg-red-950/50 border border-red-800 p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 leading-relaxed">{dataError}</p>
              </div>
            )}

            <div className="space-y-6">
              <p className="text-xs text-slate-400 leading-relaxed text-center">
                صلاحية الدخول مقتصرة فقط على الموظفين والمحاسبين المعتمدين والمصرح لهم من إدارة شبكة HO.
              </p>

              <button
                onClick={handleSignIn}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-amber-500 px-4 py-3.5 text-sm font-semibold text-slate-950 shadow-md hover:bg-amber-400 transition-colors"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.7 0 3.3.6 4.5 1.7l2.423-2.424C17.275 1.5 14.89 1 12.24 1 6.69 1 2.19 5.5 2.19 11s4.5 10 10.05 10c5.8 0 9.66-4.07 9.66-9.83 0-.66-.08-1.3-.21-1.885H12.24z"/>
                </svg>
                تسجيل الدخول باستخدام حساب Google
              </button>
            </div>
          </div>

          <div className="mt-8 flex justify-center gap-4 text-xs text-slate-500">
            <span>إصدار الإنتاج المستقر V1.0</span>
            <span>·</span>
            <span>ربط مشفر آمن تلقائي</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col antialiased" dir="rtl">
      
      {/* 1. عقود التنقل العلوية الموحدة (مترجمة بالكامل) */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        
        {/* النطاق 1: الاسم التجاري */}
        <a href="/" className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
          <Database className="h-5 w-5 text-amber-500" />
          <span>دفتر حسابات شبكة HO</span>
        </a>

        {/* النطاق 2: الروابط الرئيسية */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            onClick={() => setActiveTab('crm')}
            className={`hover:text-white transition-colors py-1 ${activeTab === 'crm' ? 'text-amber-500 font-semibold border-b-2 border-amber-500' : ''}`}
          >
            إدارة العملاء (CRM)
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`hover:text-white transition-colors py-1 ${activeTab === 'catalog' ? 'text-amber-500 font-semibold border-b-2 border-amber-500' : ''}`}
          >
            كتالوج الخدمات
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`hover:text-white transition-colors py-1 ${activeTab === 'sales' ? 'text-amber-500 font-semibold border-b-2 border-amber-500' : ''}`}
          >
            طلبات المبيعات
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`hover:text-white transition-colors py-1 ${activeTab === 'invoices' ? 'text-amber-500 font-semibold border-b-2 border-amber-500' : ''}`}
          >
            الفواتير
          </button>
          <button
            onClick={() => setActiveTab('receivables')}
            className={`hover:text-white transition-colors py-1 ${activeTab === 'receivables' ? 'text-amber-500 font-semibold border-b-2 border-amber-500' : ''}`}
          >
            حسابات الذمم المدينة
          </button>
          {(dbUser.role === 'SUPER_ADMIN' || dbUser.role === 'ADMIN') && (
            <button
              onClick={() => setActiveTab('system')}
              className={`hover:text-white transition-colors py-1 ${activeTab === 'system' ? 'text-amber-500 font-semibold border-b-2 border-amber-500' : ''}`}
            >
              التحكم والتدقيق
            </button>
          )}
        </nav>

        {/* النطاق 3: العمليات والملف الشخصي */}
        <div className="flex items-center gap-4">
          {!isInstalled && isInstallable && (
            <button
              onClick={install}
              className="hidden lg:flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 shadow-sm hover:bg-amber-400 transition"
            >
              تثبيت التطبيق (PWA)
            </button>
          )}
          {isIOS && (
            <button
              onClick={() => setShowIOSGuide(true)}
              className="hidden lg:flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              تثبيت على iOS
            </button>
          )}

          {/* معلومات الحساب الشخصي */}
          <div className="flex items-center gap-3 border-r border-slate-800 pr-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-white">{dbUser.name || fbUser.email}</p>
              <p className="text-[10px] text-slate-400 font-mono tracking-wider">الرتبة: {
                dbUser.role === 'SUPER_ADMIN' ? 'المدير العام' :
                dbUser.role === 'ADMIN' ? 'المدير المالي' :
                dbUser.role === 'ACCOUNTANT' ? 'المحاسب المالي' :
                dbUser.role === 'MEDIA_MANAGER' ? 'مدير الميديا' :
                'مستخدم عام'
              }</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut className="h-4 w-4 transform rotate-180" />
            </button>
          </div>
        </div>
      </header>

      {/* شريط الإشعارات والتنبيهات باللغة العربية */}
      {actionSuccessMsg && (
        <div className="bg-emerald-600 text-white px-6 py-3 text-sm flex items-center justify-between shadow-lg font-medium animate-slide-in">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {dataError && (
        <div className="bg-red-600 text-white px-6 py-3 text-sm flex items-center justify-between shadow-lg font-medium animate-slide-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{dataError}</span>
          </div>
          <button onClick={() => setDataError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* المحتوى الرئيسي */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 flex flex-col gap-6">
        
        {!isOnline && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            <span>وضع العمل دون اتصال: يتم استخدام البيانات المخزنة مؤقتاً، وتم إيقاف عمليات الكتابة مؤقتاً.</span>
          </div>
        )}

        {/* ترويسة العنوان والبحث والفرز */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {activeTab === 'crm' ? 'دفتر سجلات العملاء وعلاقاتهم' :
               activeTab === 'catalog' ? 'كتالوج المنتجات وعروض الخدمات' :
               activeTab === 'sales' ? 'دفتر ومسودات طلبات المبيعات' :
               activeTab === 'invoices' ? 'الفواتير والمطالبات المالية' :
               activeTab === 'receivables' ? 'دفتر الحسابات المدينة والذمم' :
               'صلاحيات الوصول وسجل العمليات للتدقيق'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {activeTab === 'crm' ? 'إدارة تصنيفات العملاء، ومتابعة معلومات الاتصال وملاحظات المعاملات.' :
               activeTab === 'catalog' ? 'قائمة الأسعار والخدمات والإعلانات والتكلفة التقديرية لتنفيذ الطلبات.' :
               activeTab === 'sales' ? 'إصدار مسودات العروض للعملاء وتأكيدها لبدء الفوترة والمطالبات.' :
               activeTab === 'invoices' ? 'استعراض ومراجعة الفواتير التي تم توليدها تلقائياً عند تأكيد طلبات البيع.' :
               activeTab === 'receivables' ? 'متابعة الذمم المالية المتبقية وغير المسددة على العملاء كأصول مدينة لـ HO.' :
               'التحكم برتب الموظفين المعتمدة ومراجعة سجل التعديلات التفصيلي للعمليات المالية.'}
            </p>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="البحث في المستندات والسجلات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9 pl-4 py-2 w-full text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* عرض التبويبات بالكامل باللغة العربية */}
        {loadingData ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent mx-auto"></div>
              <p className="mt-3 text-xs text-slate-400">جاري تحديث السجلات المالية من قاعدة بيانات Cloud SQL...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
            
            {/* تبويب: العملاء */}
            {activeTab === 'crm' && (
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                    إجمالي العملاء: {filteredCustomers.length} سجل
                  </span>
                  <button
                    onClick={() => {
                      setEditingCustomer(null);
                      setCustomerForm({ name: '', email: '', phone: '', address: '', notes: '', status: 'LEAD' });
                      setShowCustomerModal(true);
                    }}
                    className="flex items-center gap-1 bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold px-4 py-2 rounded-lg transition"
                  >
                    <Plus className="h-4.5 w-4.5" />
                    <span>إضافة عميل جديد</span>
                  </button>
                </div>

                {filteredCustomers.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Users className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm">لم يتم العثور على أي عملاء حالياً.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-xs text-right">
                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-mono">
                        <tr>
                          <th className="px-6 py-3.5 font-semibold text-right">الاسم / الشركة</th>
                          <th className="px-6 py-3.5 font-semibold text-right">الاتصال</th>
                          <th className="px-6 py-3.5 font-semibold text-right">العنوان</th>
                          <th className="px-6 py-3.5 font-semibold text-right">ملاحظات</th>
                          <th className="px-6 py-3.5 font-semibold text-right">التصنيف</th>
                          <th className="px-6 py-3.5 font-semibold text-left">العمليات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredCustomers.map((customer) => (
                          <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-semibold text-slate-950">{customer.name}</td>
                            <td className="px-6 py-4 space-y-0.5 text-slate-600 font-mono">
                              <div>{customer.email || '—'}</div>
                              <div className="text-[10px] text-slate-400">{customer.phone || ''}</div>
                            </td>
                            <td className="px-6 py-4 text-slate-500 truncate max-w-[180px]" title={customer.address || ''}>
                              {customer.address || '—'}
                            </td>
                            <td className="px-6 py-4 text-slate-500 truncate max-w-[180px]" title={customer.notes || ''}>
                              {customer.notes || '—'}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-mono font-bold tracking-wider ${
                                customer.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                customer.status === 'LEAD' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {customer.status === 'LEAD' ? 'عميل محتمل' :
                                 customer.status === 'ACTIVE' ? 'نشط' :
                                 customer.status === 'INACTIVE' ? 'غير نشط' : 'مؤرشف'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-left">
                              <button
                                onClick={() => {
                                  setEditingCustomer(customer);
                                  setCustomerForm({
                                    name: customer.name,
                                    email: customer.email || '',
                                    phone: customer.phone || '',
                                    address: customer.address || '',
                                    notes: customer.notes || '',
                                    status: customer.status,
                                  });
                                  setShowCustomerModal(true);
                                }}
                                className="text-amber-600 hover:text-amber-700 font-semibold hover:underline"
                              >
                                تعديل الملف
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* تبويب: كتالوج الخدمات والمنتجات */}
            {activeTab === 'catalog' && (
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                    إجمالي المعروضات: {filteredProducts.length} صنف
                  </span>
                  <button
                    onClick={() => setShowProductModal(true)}
                    className="flex items-center gap-1 bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold px-4 py-2 rounded-lg transition"
                  >
                    <Plus className="h-4.5 w-4.5" />
                    <span>تعريف خدمة / منتج</span>
                  </button>
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <ShoppingBag className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm">الكتالوج فارغ حالياً.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-xs text-right">
                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-mono">
                        <tr>
                          <th className="px-6 py-3.5 font-semibold text-right">رمز العنصر (SKU)</th>
                          <th className="px-6 py-3.5 font-semibold text-right">الاسم والمواصفات</th>
                          <th className="px-6 py-3.5 font-semibold text-right">الفئة</th>
                          <th className="px-6 py-3.5 font-semibold text-right">النوع</th>
                          <th className="px-6 py-3.5 font-semibold text-left">سعر البيع (USD)</th>
                          <th className="px-6 py-3.5 font-semibold text-left">التكلفة التشغيلية (USD)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredProducts.map((product) => (
                          <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-mono font-semibold text-amber-600">{product.sku}</td>
                            <td className="px-6 py-4 font-semibold text-slate-950">
                              <div>{product.name}</div>
                              <div className="text-[10px] text-slate-400 font-normal mt-0.5">{product.description || ''}</div>
                            </td>
                            <td className="px-6 py-4 text-slate-600">{product.category || '—'}</td>
                            <td className="px-6 py-4">
                              <span className="text-[10px] font-mono tracking-wider font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {product.type === 'PRODUCT' ? 'منتج مادي' :
                                 product.type === 'SERVICE' ? 'خدمة برمجية/إدارية' :
                                 product.type === 'MEDIA_BUYING' ? 'مساحة إعلانية' : 'خدمة توصيل / كابتن'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-left font-mono font-semibold tabular-nums text-slate-900">${Number(product.price).toFixed(2)}</td>
                            <td className="px-6 py-4 text-left font-mono text-slate-500 tabular-nums">${Number(product.cost).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* تبويب: طلبات وعروض المبيعات */}
            {activeTab === 'sales' && (
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                    طلبات المبيعات الحالية: {filteredOrders.length} طلب
                  </span>
                  <button
                    onClick={() => setShowOrderModal(true)}
                    className="flex items-center gap-1 bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold px-4 py-2 rounded-lg transition"
                  >
                    <Plus className="h-4.5 w-4.5" />
                    <span>إنشاء مسودة عرض سعر</span>
                  </button>
                </div>

                {filteredOrders.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Clock className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm">لا توجد طلبات مبيعات مسجلة حالياً.</p>
                  </div>
                ) : (
                  <div className="space-y-6 text-right">
                    {filteredOrders.map((order) => (
                      <div key={order.id} className="border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:border-slate-300 transition">
                        <div className="bg-slate-50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-slate-900 text-sm">{order.orderNumber}</span>
                            <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[10px] font-mono font-bold tracking-wider ${
                              order.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              order.status === 'DRAFT' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {order.status === 'DRAFT' ? 'مسودة معلقة' :
                               order.status === 'CONFIRMED' ? 'مؤكد ومفوتر' : 'ملغي'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            تاريخ التسجيل: {new Date(order.createdAt).toLocaleString('ar-SY')}
                          </div>
                        </div>

                        <div className="p-6 flex flex-col md:flex-row md:items-start justify-between gap-6">
                          <div className="space-y-4 flex-1">
                            <div>
                              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">العميل المستهدف</p>
                              <p className="text-xs font-semibold text-slate-900 mt-0.5">{order.customer?.name || '—'}</p>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">{order.customer?.email || ''}</p>
                            </div>

                            {order.notes && (
                              <div>
                                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">تعليمات التوصيل وتفاصيل الحملة</p>
                                <p className="text-xs text-slate-600 italic mt-0.5">"{order.notes}"</p>
                              </div>
                            )}

                            <div>
                              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2">البنود والخدمات المشمولة بالعرض</p>
                              <div className="border border-slate-100 rounded-lg overflow-hidden max-w-lg">
                                <table className="min-w-full divide-y divide-slate-100 text-xs text-right">
                                  <thead className="bg-slate-50/50 text-slate-400 text-[9px] font-mono uppercase">
                                    <tr>
                                      <th className="px-4 py-2">العنصر والرمز (SKU)</th>
                                      <th className="px-4 py-2 text-center">الكمية</th>
                                      <th className="px-4 py-2 text-left">السعر الإفرادي</th>
                                      <th className="px-4 py-2 text-left">الإجمالي</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {order.items?.map((item) => (
                                      <tr key={item.id}>
                                        <td className="px-4 py-2">
                                          <span className="font-mono text-amber-600 block text-[10px]">{item.product?.sku}</span>
                                          <span className="font-semibold text-slate-800">{item.product?.name}</span>
                                        </td>
                                        <td className="px-4 py-2 text-center font-mono tabular-nums">{item.quantity}</td>
                                        <td className="px-4 py-2 text-left font-mono tabular-nums">${Number(item.unitPrice).toFixed(2)}</td>
                                        <td className="px-4 py-2 text-left font-mono font-semibold tabular-nums text-slate-900">${Number(item.totalAmount).toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>

                          <div className="text-left flex flex-col items-end justify-between self-stretch gap-4 md:border-r md:border-slate-100 md:pr-6 min-w-[200px]">
                            <div className="w-full text-left">
                              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">المجموع المالي الكلي</p>
                              <p className="text-2xl font-mono font-extrabold text-slate-950 mt-1 tabular-nums">
                                ${Number(order.totalAmount).toFixed(2)}
                              </p>
                              <span className="text-[9px] font-mono text-slate-400">العملة الأساسية: دولار أمريكي</span>
                            </div>

                            {order.status === 'DRAFT' && (
                              <button
                                onClick={() => confirmOrder(order.id)}
                                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-4 py-2.5 rounded-lg transition shadow-sm w-full justify-center"
                              >
                                <Check className="h-4 w-4" />
                                <span>تأكيد العرض والفوترة الفورية</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* تبويب: الفواتير */}
            {activeTab === 'invoices' && (
              <div className="p-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono block mb-6">
                  إجمالي الفواتير المصدرة: {filteredInvoices.length} فاتورة
                </span>

                {filteredInvoices.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm">لم يتم إصدار أي فواتير حالياً.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-xs text-right">
                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-mono">
                        <tr>
                          <th className="px-6 py-3.5 font-semibold">رقم الفاتورة</th>
                          <th className="px-6 py-3.5 font-semibold">العميل المستهدف</th>
                          <th className="px-6 py-3.5 font-semibold">التفاصيل والربط</th>
                          <th className="px-6 py-3.5 font-semibold">حالة الدفع</th>
                          <th className="px-6 py-3.5 font-semibold text-left">تاريخ الاستحقاق</th>
                          <th className="px-6 py-3.5 font-semibold text-left">القيمة الإجمالية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-mono font-bold text-slate-950">{inv.invoiceNumber}</td>
                            <td className="px-6 py-4 font-semibold text-slate-900">
                              <div>{inv.customer?.name || '—'}</div>
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5">{inv.customer?.email || ''}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-slate-500 block">عدد البنود: {inv.items?.length || 0}</span>
                              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">طلب مبيعات رقم: {salesOrders.find(o => o.id === inv.salesOrderId)?.orderNumber || 'غير مرتبط'}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-mono font-bold tracking-wider ${
                                inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                inv.status === 'ISSUED' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {inv.status === 'ISSUED' ? 'بانتظار السداد' :
                                 inv.status === 'PAID' ? 'تم السداد بالكامل' : 'ملغاة'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-left font-mono text-slate-600">{inv.dueDate || '—'}</td>
                            <td className="px-6 py-4 text-left font-mono font-extrabold text-slate-950 tabular-nums">
                              ${Number(inv.totalAmount).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* تبويب: الحسابات المدينة */}
            {activeTab === 'receivables' && (
              <div className="p-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono block mb-6">
                  الذمم والديون المستحقة: {filteredReceivables.length} سجل
                </span>

                {filteredReceivables.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <CreditCard className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm">لا توجد ديون مستحقة حالياً.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-xs text-right">
                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-mono">
                        <tr>
                          <th className="px-6 py-3.5 font-semibold">اسم العميل المدين</th>
                          <th className="px-6 py-3.5 font-semibold">رقم الفاتورة المرجعية</th>
                          <th className="px-6 py-3.5 font-semibold">حالة التحصيل المالي</th>
                          <th className="px-6 py-3.5 font-semibold text-left">أصل مستحق الدين</th>
                          <th className="px-6 py-3.5 font-semibold text-left">الذمة المتبقية في العهدة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredReceivables.map((rec) => {
                          const outstanding = Number(rec.remainingAmount);
                          return (
                            <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 font-semibold text-slate-950">{rec.customer?.name || '—'}</td>
                              <td className="px-6 py-4 font-mono text-amber-600 font-bold">{rec.invoice?.invoiceNumber || '—'}</td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-mono font-bold tracking-wider ${
                                  outstanding === 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                  {outstanding === 0 ? 'مسدد بالكامل' : 'ذمة مالية مستحقة'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-left font-mono text-slate-600 tabular-nums">${Number(rec.totalAmount).toFixed(2)}</td>
                              <td className="px-6 py-4 text-left font-mono font-extrabold text-red-600 tabular-nums">
                                ${outstanding.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* تبويب: التحكم والتدقيق (للمسؤولين) */}
            {activeTab === 'system' && (dbUser.role === 'SUPER_ADMIN' || dbUser.role === 'ADMIN') && (
              <div className="p-6 space-y-8 text-right">
                
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-amber-500" />
                    <span>صلاحيات الموظفين وأدوار الوصول (RBAC)</span>
                  </h3>
                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="min-w-full divide-y divide-slate-100 text-xs text-right">
                      <thead className="bg-slate-50 text-slate-400 font-mono uppercase text-[9px]">
                        <tr>
                          <th className="px-6 py-3">البريد الإلكتروني / معرف المستخدم</th>
                          <th className="px-6 py-3">الاسم الكامل</th>
                          <th className="px-6 py-3">تاريخ التسجيل</th>
                          <th className="px-6 py-3 text-left">صلاحية الوصول</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {systemUsers.map((u) => (
                          <tr key={u.id}>
                            <td className="px-6 py-4">
                              <span className="font-semibold block text-slate-950">{u.email}</span>
                              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">{u.uid}</span>
                            </td>
                            <td className="px-6 py-4 text-slate-600 font-semibold">{u.name || '—'}</td>
                            <td className="px-6 py-4 text-slate-500 font-mono">{new Date(u.createdAt).toLocaleDateString('ar-SY')}</td>
                            <td className="px-6 py-4 text-left">
                              <select
                                value={u.role}
                                onChange={(e) => changeUserRole(u.uid, e.target.value)}
                                className="text-xs bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none"
                                disabled={u.role === 'SUPER_ADMIN' && dbUser.role !== 'SUPER_ADMIN'}
                              >
                                <option value="SUPER_ADMIN">المدير العام</option>
                                <option value="ADMIN">المدير المالي</option>
                                <option value="ACCOUNTANT">المحاسب المالي</option>
                                <option value="MEDIA_MANAGER">مدير الميديا</option>
                                <option value="DELIVERY_MANAGER">مدير التوصيل والعهدة</option>
                                <option value="DRIVER">كابتن التوصيل</option>
                                <option value="EMPLOYEE">موظف</option>
                                <option value="VIEWER">مشاهد فقط</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Settings className="h-5 w-5 text-amber-500" />
                    <span>سجل العمليات والتدقيق غير القابل للتعديل لقاعدة البيانات</span>
                  </h3>
                  <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-[350px]">
                    <table className="min-w-full divide-y divide-slate-100 text-xs text-right">
                      <thead className="bg-slate-50 text-slate-400 font-mono uppercase text-[9px] sticky top-0">
                        <tr>
                          <th className="px-6 py-3">تاريخ ووقت العملية</th>
                          <th className="px-6 py-3">الموظف الفاعل</th>
                          <th className="px-6 py-3">الحدث / العملية</th>
                          <th className="px-6 py-3">تصنيف الكائن والمعرف</th>
                          <th className="px-6 py-3">تفاصيل التغييرات التراكمية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-3 font-mono text-slate-400 text-[10px]">
                              {new Date(log.timestamp).toLocaleString('ar-SY')}
                            </td>
                            <td className="px-6 py-3">
                              <span className="font-semibold block text-slate-800">{log.actorEmail || 'النظام التلقائي'}</span>
                            </td>
                            <td className="px-6 py-3">
                              <span className="font-mono text-xs text-amber-600 font-bold">{log.action}</span>
                            </td>
                            <td className="px-6 py-3 text-slate-500 font-mono text-[10px]">
                              {log.entityType} ({log.entityId})
                            </td>
                            <td className="px-6 py-3 text-[10px] text-slate-500 font-mono max-w-[300px] truncate text-left" title={`حالة سابقة: ${log.beforeState || 'لا يوجد'} \nالحالة اللاحقة: ${log.afterState}`}>
                              {log.afterState ? `اللاحق: ${log.afterState}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}
      </main>

      {/* التذييل */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 py-6 px-6 mt-12 text-right">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div>
            &copy; 2026 شبكة HO. كافة سجلات الفوترة ودفتر القيود المزدوجة محمية ومثبتة في قاعدة البيانات.
          </div>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1">
              <Database className="h-3.5 w-3.5 text-amber-500" />
              <span>مستودع السجلات: Cloud SQL (PostgreSQL)</span>
            </span>
            <span>بوابة المصادقة v3.5</span>
          </div>
        </div>
      </footer>

      {/* نافذة: العميل */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-xl border border-slate-200 text-right">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm tracking-tight">{editingCustomer ? 'تعديل السجل التعريفي للعميل' : 'تسجيل عميل جديد (CRM)'}</h3>
              <button onClick={() => setShowCustomerModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={saveCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">اسم العميل / الشركة</label>
                <input
                  type="text"
                  required
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none"
                  placeholder="مثال: شركة النجم للتسويق والخدمات"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none"
                    placeholder="client@company.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">الهاتف</label>
                  <input
                    type="text"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none"
                    placeholder="+9639..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">العنوان الرئيسي</label>
                <input
                  type="text"
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none"
                  placeholder="مثال: دمشق، شارع بغداد، بناء 10"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">تصنيف الحالة الحالية</label>
                <select
                  value={customerForm.status}
                  onChange={(e) => setCustomerForm({ ...customerForm, status: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none"
                >
                  <option value="LEAD">عميل محتمل (مفاوضات العروض)</option>
                  <option value="ACTIVE">عميل نشط (معاملات جارية)</option>
                  <option value="INACTIVE">غير نشط</option>
                  <option value="ARCHIVED">مؤرشف</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">ملاحظات العمل والنشاط</label>
                <textarea
                  value={customerForm.notes}
                  onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                  rows={3}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none"
                  placeholder="أهداف الحملة الإعلانية، متطلبات التوصيل والعهدة..."
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow-sm"
                >
                  حفظ سجل العميل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة: صنف الخدمة */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-xl border border-slate-200 text-right">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm tracking-tight">تعريف خدمة / منتج جديدة في الكتالوج</h3>
              <button onClick={() => setShowProductModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={saveProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">اسم الصنف / الخدمة</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none"
                  placeholder="مثال: حملة إعلانية ممولة فيسبوك"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">الرمز الفريد للكتالوج (SKU)</label>
                  <input
                    type="text"
                    required
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value.toUpperCase() })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none font-mono text-amber-600 font-semibold"
                    placeholder="MFB-CAMP"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">فئة الخدمة</label>
                  <input
                    type="text"
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none"
                    placeholder="ميديا، توصيل، خدمات"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">نوع المعروض</label>
                  <select
                    value={productForm.type}
                    onChange={(e) => setProductForm({ ...productForm, type: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none"
                  >
                    <option value="PRODUCT">منتج مادي</option>
                    <option value="SERVICE">خدمة تشغيلية/إدارية</option>
                    <option value="MEDIA_BUYING">شراء مساحة إعلانية</option>
                    <option value="DELIVERY">توصيل شحنات وطرود</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">سعر البيع الافتراضي (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none font-mono"
                    placeholder="150.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">التكلفة التشغيلية المباشرة (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={productForm.cost}
                  onChange={(e) => setProductForm({ ...productForm, cost: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none font-mono"
                  placeholder="50.00"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">الوصف والمواصفات</label>
                <textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  rows={2}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none"
                  placeholder="تضمين الأبعاد، النطاق الجغرافي للتوصيل، أو تفاصيل العقد..."
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow-sm"
                >
                  حفظ الصنف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة: إنشاء عرض مبيعات */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-xl border border-slate-200 text-right">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm tracking-tight">إصدار مسودة عرض سعر ومبيعات جديد</h3>
              <button onClick={() => setShowOrderModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={saveSalesOrder} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">العميل المستهدف (CRM)</label>
                <select
                  required
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none"
                >
                  <option value="">-- اختر حساب العميل من القائمة --</option>
                  {customers.filter(c => c.status === 'ACTIVE' || c.status === 'LEAD').map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.status === 'LEAD' ? 'محتمل' : 'نشط'})</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">بنود العرض</label>
                  <button
                    type="button"
                    onClick={() => setOrderItems([...orderItems, { productId: '', quantity: 1 }])}
                    className="text-amber-600 hover:text-amber-700 text-xs font-bold flex items-center gap-0.5"
                  >
                    <Plus className="h-3 w-3" /> إضافة بند جديد
                  </button>
                </div>

                <div className="space-y-3 max-h-[160px] overflow-y-auto border border-slate-100 p-3 rounded-xl bg-slate-50/50">
                  {orderItems.map((item, idx) => (
                    <div key={idx} className="flex gap-3 items-center">
                      <select
                        required
                        value={item.productId}
                        onChange={(e) => {
                          const updated = [...orderItems];
                          updated[idx].productId = e.target.value;
                          setOrderItems(updated);
                        }}
                        className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none"
                      >
                        <option value="">-- اختر العنصر المطلوب --</option>
                        {products.filter(p => p.status === 'ACTIVE').map((p) => (
                          <option key={p.id} value={p.id}>{p.sku} - {p.name} (${Number(p.price).toFixed(2)})</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        required
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...orderItems];
                          updated[idx].quantity = Number(e.target.value);
                          setOrderItems(updated);
                        }}
                        className="w-16 text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-center font-mono"
                        placeholder="الكمية"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          const updated = orderItems.filter((_, i) => i !== idx);
                          setOrderItems(updated);
                        }}
                        className="text-red-500 hover:text-red-700"
                        disabled={orderItems.length === 1}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">تعليمات التشغيل / مستندات التسليم</label>
                <textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  rows={2}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none"
                  placeholder="ملاحظات توجيه كابتن التوصيل، روابط الحملة، أو شروط دفع مرنة..."
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl flex justify-between items-center border border-slate-100">
                <span className="text-xs font-semibold text-slate-500">المجموع المالي الكلي للعرض</span>
                <span className="font-mono font-extrabold text-lg text-slate-900">
                  ${orderItems.reduce((acc, curr) => {
                    const matched = products.find(p => String(p.id) === curr.productId);
                    const price = matched ? Number(matched.price) : 0;
                    return acc + (price * curr.quantity);
                  }, 0).toFixed(2)}
                </span>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow-sm"
                >
                  إصدار عرض المبيعات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة: تثبيت iOS */}
      {showIOSGuide && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 text-right">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Database className="h-5 w-5 text-amber-500" />
              <span>التثبيت على أجهزة iPhone / iPad</span>
            </h3>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              لتثبيت تطبيق <strong>دفتر حسابات شبكة HO</strong> على شاشتك الرئيسية:
            </p>
            <ol className="mt-3 text-xs text-slate-700 space-y-2 list-decimal list-inside font-medium">
              <li>افتح المتصفح Safari واضغط على أيقونة <strong className="text-amber-600">المشاركة</strong> في الشريط السفلي.</li>
              <li>قم بالتمرير للأسفل واختر خيار <strong className="text-amber-600">إضافة إلى الشاشة الرئيسية</strong>.</li>
              <li>أكد الاسم واضغط على <strong className="text-amber-600">إضافة</strong> في الزاوية العلوية اليسرى.</li>
            </ol>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-6 w-full rounded-lg bg-slate-900 hover:bg-slate-800 py-2.5 text-xs font-bold text-white transition shadow-sm"
            >
              إغلاق الإرشادات
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
