import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import LogoutButton from '@/components/auth/logout-button';
import Nav from '@/components/layout/nav';
import { isAdmin } from '@/lib/auth';

export default async function ApiLogsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check admin and pass true to Nav (we know they're admin if they got here)
  if (!(await isAdmin(user.id))) {
    redirect('/dashboard');
  }

  // Get all API logs
  const { data: logs } = await supabase
    .from('api_logs')
    .select('*, receipts(store_name)')
    .order('created_at', { ascending: false })
    .limit(100);

  // Calculate totals
  const totalCost =
    logs?.reduce(
      (sum, log) => sum + (parseFloat(log.estimated_cost) || 0),
      0
    ) || 0;
  const totalTokens =
    logs?.reduce((sum, log) => sum + (log.total_tokens || 0), 0) || 0;
  const successCount =
    logs?.filter((log) => log.parsing_successful).length || 0;
  const failureCount =
    logs?.filter((log) => !log.parsing_successful).length || 0;
  const truncatedCount = logs?.filter((log) => log.was_truncated).length || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav userEmail={user.email || ''} isAdmin={true} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold">API Usage Logs</h2>
          <p className="text-gray-600 mt-1">
            Track OpenAI API calls, token usage, and costs
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Total Calls</div>
            <div className="text-2xl font-bold">{logs?.length || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Success Rate</div>
            <div className="text-2xl font-bold text-green-600">
              {logs?.length
                ? ((successCount / logs.length) * 100).toFixed(0)
                : 0}
              %
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Truncated</div>
            <div className="text-2xl font-bold text-amber-600">
              {truncatedCount}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Total Tokens</div>
            <div className="text-2xl font-bold">
              {totalTokens.toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Estimated Cost</div>
            <div className="text-2xl font-bold text-blue-600">
              ${totalCost.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date/Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receipt
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Enhanced
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tokens
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs?.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/receipts/${log.receipt_id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {(log.receipts as any)?.store_name || 'View Receipt'}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {log.parsing_successful ? (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                            Success
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                            Failed
                          </span>
                        )}
                        {log.was_truncated && (
                          <span className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded">
                            Truncated
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.items_parsed}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {log.items_enhanced > 0 ? (
                        <span className="text-emerald-600 font-medium">
                          {log.items_enhanced}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <div className="text-xs">
                        <div>In: {log.prompt_tokens?.toLocaleString()}</div>
                        <div>
                          Out: {log.completion_tokens?.toLocaleString()}
                        </div>
                        <div className="font-medium">
                          Total: {log.total_tokens?.toLocaleString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${parseFloat(log.estimated_cost).toFixed(4)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <details className="cursor-pointer">
                        <summary className="text-blue-600 hover:text-blue-800">
                          View Response
                        </summary>
                        <div className="mt-2 p-3 bg-gray-100 rounded text-xs max-w-md overflow-auto max-h-60">
                          <pre className="whitespace-pre-wrap">
                            {log.response_text?.substring(0, 1000)}
                            {log.response_text &&
                              log.response_text.length > 1000 &&
                              '...'}
                          </pre>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
