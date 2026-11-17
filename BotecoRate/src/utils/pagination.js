export const PAGE_SIZE = 20;

export function paginate(items, requestedPage = 1, pageSize = PAGE_SIZE) {
  const size = Number.isInteger(pageSize) ? Math.min(50, Math.max(1, pageSize)) : PAGE_SIZE;
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(pages, Math.max(1, Number.isInteger(requestedPage) ? requestedPage : 1));
  const start = (page - 1) * size;
  return { items: items.slice(start, start + size), page, pages, total,
    first: total ? start + 1 : 0, last: Math.min(total, start + size) };
}
