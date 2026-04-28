import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <>
      <h1
        className="text-2xl text-navy-900 font-display mb-1"
        style={{ letterSpacing: "-0.015em" }}
      >
        Welcome back
      </h1>
      <p className="text-[13px] text-ink-500 mb-6">
        Sign in to your stable.
      </p>

      <LoginForm />

      <p className="text-sm text-ink-600 mt-6 pt-5 border-t border-ink-100">
        New yard?{" "}
        <Link
          href="/signup"
          className="font-medium text-brand-700 hover:text-brand-800"
        >
          Create an account →
        </Link>
      </p>
    </>
  );
}
