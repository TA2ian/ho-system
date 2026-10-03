import { z } from "zod";

export const salesOrderStatusSchema = z.enum(["draft", "confirmed", "cancelled"]);
export type SalesOrderStatus = z.infer<typeof salesOrderStatusSchema>;

export interface SalesOrder {
  id: string;
  customerId: string;
  orderNumber: string;
  status: SalesOrderStatus;
  currencyCode: string;
  notes: string | null;
  createdBy: string;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SalesOrderLine {
  id: string;
  salesOrderId: string;
  lineNumber: number;
  catalogItemId: string;
  description: string;
  quantity: string;
  unit: string;
  unitCost: string;
  unitPrice: string;
  currencyCode: string;
  createdAt: Date;
}
