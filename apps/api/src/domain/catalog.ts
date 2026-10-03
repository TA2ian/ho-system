import { z } from "zod";

export const catalogItemKindSchema = z.enum(["product", "material", "service"]);
export type CatalogItemKind = z.infer<typeof catalogItemKindSchema>;

export const catalogItemUnitSchema = z.string().trim().min(1).max(30);
export const catalogCodeSchema = z.string().trim().min(2).max(80).regex(
  /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/,
  "Invalid catalog code"
);

export interface CatalogCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CatalogItem {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  description: string | null;
  itemKind: CatalogItemKind;
  unit: string;
  currencyCode: string;
  costPrice: string;
  salePrice: string;
  isDeliverable: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
