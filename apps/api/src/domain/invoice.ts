import { z } from "zod";

export const invoiceStatusSchema = z.enum(["draft", "issued", "voided"]);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

export interface Invoice {
  id: string;
  customerId: string;
  sourceSalesOrderId: string | null;
  invoiceNumber: string;
  status: InvoiceStatus;
  currencyCode: string;
  totalAmount: string;
  issueDate: string | null;
  dueDate: string | null;
  notes: string | null;
  createdBy: string;
  issuedAt: Date | null;
  voidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  lineNumber: number;
  salesOrderLineId: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  lineTotal: string;
  currencyCode: string;
  createdAt: Date;
}
