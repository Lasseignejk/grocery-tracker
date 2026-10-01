import type { createClient } from '@/lib/supabase/server';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { ITEM_LINE_SELECT, groupIntoProducts } from '@/lib/items';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Loads every receipt line for the user, with its receipt's store and date
export async function fetchItemLines(supabase: SupabaseClient, userId: string) {
  return fetchAll((from, to) =>
    supabase
      .from('receipt_items')
      .select(ITEM_LINE_SELECT)
      .eq('receipts.user_id', userId)
      .order('id')
      .range(from, to)
  );
}

// Loads every receipt line for the user, grouped into products
export async function fetchProducts(supabase: SupabaseClient, userId: string) {
  return groupIntoProducts(await fetchItemLines(supabase, userId));
}
