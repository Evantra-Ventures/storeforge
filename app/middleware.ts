import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },

        set(name, value, options) {
          request.cookies.set({
            name,
            value,
            ...options,
          });

          response = NextResponse.next({
            request,
          });

          response.cookies.set({
            name,
            value,
            ...options,
          });
        },

        remove(name, options) {
          request.cookies.set({
            name,
            value: "",
            ...options,
          });

          response = NextResponse.next({
            request,
          });

          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  // GET USER
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // DASHBOARD ROUTES
  const protectedRoutes = [
    "/products",
    "/orders",
    "/analytics",
    "/settings",
  ];

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // NOT LOGGED IN
  if (isProtectedRoute && !user) {
    return NextResponse.redirect(
      new URL("/login", request.url)
    );
  }

  // CHECK PROFILE + TENANT
  if (user && isProtectedRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    // NO TENANT
    if (!profile?.tenant_id) {
      return NextResponse.redirect(
        new URL("/onboarding", request.url)
      );
    }
  }

  // ALREADY LOGGED IN
  if (
    user &&
    ["/login", "/signup"].includes(pathname)
  ) {
    return NextResponse.redirect(
      new URL("/products", request.url)
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/products/:path*",
    "/orders/:path*",
    "/analytics/:path*",
    "/settings/:path*",
    "/login",
    "/signup",
  ],
};