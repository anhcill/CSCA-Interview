export function parsePagination(query: { page?: unknown; limit?: unknown }) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  return { limit, page, skip };
}

export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    limit,
    page,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };
}
