import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: { sent?: string };
}) {
  const sentEmail = searchParams?.sent;

  if (sentEmail) {
    return (
      <>
        <div className="flex flex-col gap-3">
          <h1 className="text-xl font-semibold tracking-tightest text-ink-900">
            Check your email
          </h1>
          <p className="text-sm text-ink-700 leading-relaxed">
            If an account exists for <strong>{sentEmail}</strong>, we&rsquo;ve sent a
            password-reset link. The link expires in one hour — check your spam folder
            if it doesn&rsquo;t arrive within a couple of minutes.
          </p>
          <p className="text-sm text-ink-500">
            Still stuck? Email{" "}
            <a className="text-brand-700 underline" href="mailto:hello@longrein.eu">
              hello@longrein.eu
            </a>
            .
          </p>
        </div>

        <p className="text-sm text-ink-600 mt-6 pt-5 border-t border-ink-100">
          <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
            ← Back to sign in
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <ForgotPasswordForm />

      <p className="text-sm text-ink-600 mt-6 pt-5 border-t border-ink-100">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
          Back to sign in →
        </Link>
      </p>
    </>
  );
}
