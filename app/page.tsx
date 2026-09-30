import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is logged in, redirect to dashboard
  if (user) {
    redirect('/dashboard');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-b from-blue-50 to-white">
      <div className="text-center space-y-8 max-w-3xl">
        <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Receipt Tracker
        </h1>
        <p className="text-xl text-gray-600">
          Upload your grocery receipts, track your spending, and discover
          insights about your shopping habits.
        </p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/signup"
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
          >
            Sign In
          </Link>
        </div>

        <div className="pt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 bg-white rounded-xl shadow-sm">
            <div className="text-4xl mb-4">📸</div>
            <h3 className="font-semibold mb-2">Upload Receipts</h3>
            <p className="text-gray-600 text-sm">
              Snap a photo of your receipt and upload it instantly
            </p>
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="font-semibold mb-2">AI Parsing</h3>
            <p className="text-gray-600 text-sm">
              Automatically extract items, prices, and store info
            </p>
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="font-semibold mb-2">Track Insights</h3>
            <p className="text-gray-600 text-sm">
              See spending patterns and find the best deals
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
