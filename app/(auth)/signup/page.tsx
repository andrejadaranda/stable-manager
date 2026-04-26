import Link from "next/link";
import { SignupOwnerForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <>
      <SignupOwnerForm />
      <p className="text-sm text-neutral-600 mt-5">
        Already have an account?{" "}
        <Link href="/login" className="underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </>
  );
}
