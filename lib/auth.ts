import { createClient } from '@/lib/supabase/server';

export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  return !!data;
}
