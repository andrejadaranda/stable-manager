import Link from "next/link";
import { SignupOwnerForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <>
      <SignupOwnerForm />
      <p className="text-sm text-ink-600 mt-6 pt-5 border-t border-ink-100">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-brand-700 hover:text-brand-800"
        >
          Sign in →
        </Link>
      </p>
    </>
  );
}
