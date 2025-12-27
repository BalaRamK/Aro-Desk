import Link from 'next/link'

export const metadata = {
  title: 'Reset Password',
}

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md space-y-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">Reset your password</h1>
          <p className="text-sm text-slate-600">
            This feature is coming soon. If you need access, please contact your admin or return to login.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
          >
            Back to login
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Create account
          </Link>
        </div>
      </div>
    </main>
  )
}
