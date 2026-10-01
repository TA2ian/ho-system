// src/data/customers/customerService.ts
import { auth } from '../../lib/firebase.ts';

// واجهة تعريف العميل بما يتوافق مع واجهة تطبيق HO وعرض الحسابات
export interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: string; // LEAD, ACTIVE, INACTIVE, ARCHIVED
  createdAt: string;
  updatedAt: string;
}

// دالة لمعالجة وتوطين أخطاء النظام إلى رسائل عربية مفهومة ومريحة للمستخدم
function handleServiceError(error: any): never {
  console.error("SQL Connect Service Error:", error);
  const errMsg = error?.message || String(error);

  if (errMsg.includes("Unauthorized") || errMsg.includes("401") || errMsg.includes("403")) {
    throw new Error("ليست لديك الصلاحيات المالية الكافية لتسجيل أو تعديل بيانات العملاء في النظام.");
  }
  if (errMsg.includes("network") || errMsg.includes("offline") || errMsg.includes("fetch")) {
    throw new Error("فشل الاتصال بقاعدة البيانات السحابية Cloud SQL. يرجى التحقق من اتصال الإنترنت.");
  }
  if (errMsg.includes("unique constraint") || errMsg.includes("already exists")) {
    throw new Error("رقم الهاتف أو البريد الإلكتروني مسجل بالفعل لعميل آخر.");
  }
  
  throw new Error("حدث خطأ أثناء معالجة بيانات العميل. يرجى المحاولة مرة أخرى أو مراجعة المشرف المالي.");
}

/**
 * جلب قائمة العملاء وعلاقاتهم (CRM) بالكامل من خلال Express REST API المدعوم بـ Drizzle + Cloud SQL
 */
export async function listCustomersData(): Promise<Customer[]> {
  try {
    const token = await auth.currentUser?.getIdToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    const response = await fetch('/api/customers', { headers });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to fetch customers: ${response.status}`);
    }

    const data = await response.json();
    return data.map((c: any) => ({
      id: c.id,
      name: c.name,
      email: c.email || null,
      phone: c.phone || null,
      address: c.address || null,
      notes: c.notes || null,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  } catch (error) {
    return handleServiceError(error);
  }
}

/**
 * تسجيل عميل جديد (CRM) في قاعدة البيانات باستخدام Express REST API
 */
export async function createNewCustomer(variables: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
  try {
    const token = await auth.currentUser?.getIdToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const cleanVariables = {
      name: variables.name,
      email: variables.email || null,
      phone: variables.phone || null,
      address: variables.address || null,
      notes: variables.notes || null,
      status: variables.status || 'LEAD',
    };

    const response = await fetch('/api/customers', {
      method: 'POST',
      headers,
      body: JSON.stringify(cleanVariables),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to create customer: ${response.status}`);
    }
  } catch (error) {
    handleServiceError(error);
  }
}

/**
 * تحديث بيانات العميل وتصنيفه في سجلات الشركة باستخدام Express REST API
 */
export async function editCustomerData(variables: Partial<Customer> & { id: number }): Promise<void> {
  try {
    const token = await auth.currentUser?.getIdToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const cleanVariables = {
      name: variables.name,
      email: variables.email || null,
      phone: variables.phone || null,
      address: variables.address || null,
      notes: variables.notes || null,
      status: variables.status,
    };

    const response = await fetch(`/api/customers/${variables.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(cleanVariables),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to update customer: ${response.status}`);
    }
  } catch (error) {
    handleServiceError(error);
  }
}
