// Refreshes the Supabase session cookie on every request and gates app routes.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n: string) => request.cookies.get(n)?.value,
        set: (n: string, v: string, o: CookieOptions) => {
          request.cookies.set({ name: n, value: v, ...o });
          response.cookies.set({ name: n, value: v, ...o });
        },
        remove: (n: string, o: CookieOptions) => {
          request.cookies.set({ name: n, value: "", ...o });
          response.cookies.set({ name: n, value: "", ...o });
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Gate the app — anything under (dashboard) requires auth.
  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith("/dashboard");
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/signup");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/public).*)"],
};
