import { z } from "zod";
export const deliveryTypeSchema = z.enum(["external", "internal"]);
export type DeliveryType = z.infer<typeof deliveryTypeSchema>;
export const deliveryStatusSchema = z.enum(["pending", "assigned", "out_for_delivery", "delivered", "failed", "returned", "cancelled"]);
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;
