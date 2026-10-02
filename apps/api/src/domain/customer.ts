import { z } from "zod";

export const customerTypeSchema = z.enum(["individual", "business"]);
export type CustomerType = z.infer<typeof customerTypeSchema>;

export const customerStatusSchema = z.enum(["active", "inactive", "blocked"]);
export type CustomerStatus = z.infer<typeof customerStatusSchema>;

export interface Customer {
  id: string;
  type: CustomerType;
  displayName: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: CustomerStatus;
  createdAt: Date;
  updatedAt: Date;
}
