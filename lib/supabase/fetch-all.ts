// Supabase caps every response at the project's max rows (1000 by default)
// without returning an error, so queries that need every row have to page
// through with .range(). The query must have a stable order (e.g. by id).
export async function fetchAll<T>(
  query: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000
): Promise<T[]> {
  const rows: T[] = [];

  while (true) {
    const { data, error } = await query(rows.length, rows.length + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) return rows;
    rows.push(...data);
  }
}
