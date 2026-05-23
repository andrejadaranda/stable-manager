// The existing owner signup form, moved off the landing page so the
// landing page can lead with the role picker.

import Link from "next/link";
import { SignupOwnerForm } from "@/components/auth/signup-form";

export default function SignupOwnerPage() {
  return (
    <>
      <SignupOwnerForm />
      <p className="text-sm text-ink-600 mt-6 pt-5 border-t border-ink-100">
        Joining an existing stable?{" "}
        <Link
          href="/signup/join"
          className="font-medium text-brand-700 hover:text-brand-800"
        >
          Find your stable →
        </Link>
      </p>
      <p className="text-sm text-ink-600 mt-2">
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
