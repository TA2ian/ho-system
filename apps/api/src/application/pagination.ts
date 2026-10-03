import { z } from "zod";
import { ApplicationError } from "../domain/errors.js";

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).max(100_000).default(0)
});

export type Pagination = z.infer<typeof paginationQuerySchema>;

export type PageMeta = Pagination & {
  hasMore: boolean;
};

export function parsePaginationQuery(query: unknown): Pagination {
  const parsed = paginationQuerySchema.safeParse(query ?? {});
  if (!parsed.success) {
    throw new ApplicationError(
      "PAGINATION_INVALID",
      400,
      "معاملات التصفح غير صالحة"
    );
  }
  return parsed.data;
}

export function pageRows<T>(rows: T[], pagination: Pagination): { rows: T[]; meta: PageMeta } {
  const hasMore = rows.length > pagination.limit;
  return {
    rows: hasMore ? rows.slice(0, pagination.limit) : rows,
    meta: { ...pagination, hasMore }
  };
}
