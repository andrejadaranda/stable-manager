import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <>
      <h1
        className="text-2xl text-navy-900 font-display mb-1"
        style={{ letterSpacing: "-0.015em" }}
      >
        Sveiki sugrįžę
      </h1>
      <p className="text-[13px] text-ink-500 mb-6">
        Prisijunk prie savo arklidės.
      </p>

      <LoginForm />

      <p className="text-sm text-ink-600 mt-6 pt-5 border-t border-ink-100">
        Naujas yard'as?{" "}
        <Link
          href="/signup"
          className="font-medium text-brand-700 hover:text-brand-800"
        >
          Sukurti paskyrą →
        </Link>
      </p>
    </>
  );
}
