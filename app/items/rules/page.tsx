import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Nav from '@/components/layout/nav';
import ItemsHeader from '@/components/items/items-header';
import MergeRulesList from '@/components/items/merge-rules-list';
import { isAdmin } from '@/lib/auth';

export default async function MergeRulesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const userIsAdmin = await isAdmin(user.id);

  const { data: rules } = await supabase
    .from('item_merge_rules')
    .select('*')
    .eq('user_id', user.id)
    .order('target_item_name')
    .order('created_at');

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav userEmail={user.email || ''} isAdmin={userIsAdmin} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ItemsHeader />
        <MergeRulesList rules={rules ?? []} />
      </main>
    </div>
  );
}
