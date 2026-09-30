import Link from 'next/link';
import SignupForm from '@/components/auth/signup-form';
import GoogleSignInButton from '@/components/auth/google-signin-button';

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Create Account</h1>
          <p className="mt-2 text-gray-600">Start tracking your receipts</p>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-lg">
          {/* Google Sign-In Button */}
          <GoogleSignInButton />

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">
                Or continue with email
              </span>
            </div>
          </div>

          {/* Email/Password Form */}
          <SignupForm />

          <div className="mt-6 text-center text-sm">
            <span className="text-gray-600">Already have an account? </span>
            <Link
              href="/login"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
