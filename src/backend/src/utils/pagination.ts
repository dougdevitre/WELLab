import { Request } from 'express';

export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta & { timestamp: string };
}

/**
 * Extract pagination parameters from the request query string.
 */
export function parsePagination(req: Request): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 20));
  const sortBy = (req.query.sortBy as string) || undefined;
  const sortOrder = req.query.sortOrder === 'desc' ? 'desc' : 'asc';

  return { page, pageSize, sortBy, sortOrder };
}

/**
 * Apply pagination (and optional sorting) to an in-memory array and
 * return the paginated response object.
 */
export function paginate<T extends Record<string, unknown>>(
  items: T[],
  params: PaginationParams,
): PaginatedResponse<T> {
  let sorted = [...items];

  if (params.sortBy) {
    const key = params.sortBy;
    sorted.sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (aVal < bVal) return params.sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return params.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const total = sorted.length;
  const totalPages = Math.ceil(total / params.pageSize);
  const start = (params.page - 1) * params.pageSize;
  const data = sorted.slice(start, start + params.pageSize);

  return {
    success: true,
    data,
    meta: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages,
      timestamp: new Date().toISOString(),
    },
  };
}
