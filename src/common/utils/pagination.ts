export interface PageOptions {
  page: number;
  limit: number;
  skip: number;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PageMeta;
}

export function parsePageOptions(
  query: Record<string, unknown>,
  defaultLimit = 20,
  maxLimit = 100,
): PageOptions {
  const numeric = (value: unknown, fallback: number) => {
    const parsed = Number(Array.isArray(value) ? value[0] : value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  };
  const page = numeric(query.page, 1);
  const limit = Math.min(numeric(query.limit, defaultLimit), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

export function pageResult<T>(
  items: T[],
  total: number,
  options: PageOptions,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / options.limit);
  return {
    items,
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      totalPages,
      hasNextPage: options.page < totalPages,
      hasPreviousPage: options.page > 1 && totalPages > 0,
    },
  };
}

export function queryString(value: unknown): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : undefined;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
