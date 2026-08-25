import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";

export default async function LoginPage() {
  const t = await getTranslations("auth.login");

  return (
    <>
      <LoginForm />

      <div className="flex flex-col gap-3 mt-6 pt-5 border-t border-ink-100">
        <p className="text-sm text-ink-600">
          {t("forgotPassword")}{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-brand-700 hover:text-brand-800"
          >
            {t("resetLink")}
          </Link>
        </p>
        <p className="text-sm text-ink-600">
          {t("newYard")}{" "}
          <Link
            href="/signup"
            className="font-medium text-brand-700 hover:text-brand-800"
          >
            {t("signupLink")}
          </Link>
        </p>

        {/* The switcher lives on the login page specifically because this
            is the one screen every user reaches before we know anything
            about them. Someone who lands here in the wrong language has
            no other way to fix it. */}
        <div className="pt-2">
          <LanguageSwitcher />
        </div>
      </div>
    </>
  );
}
