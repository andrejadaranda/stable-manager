import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <>
      <LoginForm />

      <div className="flex flex-col gap-3 mt-6 pt-5 border-t border-ink-100">
        <p className="text-sm text-ink-600">
          Forgot your password?{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-brand-700 hover:text-brand-800"
          >
            Reset it →
          </Link>
        </p>
        <p className="text-sm text-ink-600">
          New yard?{" "}
          <Link
            href="/signup"
            className="font-medium text-brand-700 hover:text-brand-800"
          >
            Create an account →
          </Link>
        </p>
      </div>
    </>
  );
}
