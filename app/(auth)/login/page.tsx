import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <>
      <LoginForm />
      <p className="text-sm text-ink-600 mt-6 pt-5 border-t border-ink-100">
        New stable?{" "}
        <Link
          href="/signup"
          className="font-medium text-brand-700 hover:text-brand-800"
        >
          Create one →
        </Link>
      </p>
    </>
  );
}
