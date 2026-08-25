"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, isLocale } from "./config";

// Sets the language cookie and re-renders.
//
// revalidatePath("/", "layout") is what makes the switch take effect
// everywhere at once: the locale is read in the root layout, so anything
// short of invalidating the whole layout tree leaves already-rendered
// segments in the old language.

export async function setLocale(formData: FormData): Promise<void> {
  const next = formData.get("locale");

  // Ignore anything that isn't a language we ship. The value comes from a
  // form post, so it is attacker-controlled — writing it into a cookie
  // unchecked would let someone steer the dynamic import in
  // i18n/request.ts.
  if (typeof next !== "string" || !isLocale(next)) return;

  cookies().set(LOCALE_COOKIE, next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });

  revalidatePath("/", "layout");
}
