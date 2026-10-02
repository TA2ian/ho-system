import { z } from "zod";

export const paymentStatusSchema = z.enum(["recorded", "voided"]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const paymentMethodSchema = z.enum(["cash", "sham_cash"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export interface Payment {
  id: string;
  customerId: string;
  paymentNumber: string;
  status: PaymentStatus;
  amount: string;
  currencyCode: string;
  method: PaymentMethod;
  reference: string | null;
  receivedAt: Date;
  receivedBy: string;
  notes: string | null;
  voidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  invoiceId: string;
  amount: string;
  currencyCode: string;
  createdAt: Date;
}
