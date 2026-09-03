import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { firstAllowedPath, normalizeViewPermissions, permissionForPath } from "@/lib/permissions";

const PUBLIC_ROUTES = ["/login", "/recuperar-senha", "/redefinir-senha", "/offline"];

type CookieToSet = { name: string; value: string; options: CookieOptions };
type CollaboratorAccess = {
  role: "vendedor" | "cobrador";
  is_active: boolean;
  view_permissions: string[] | null;
};

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  let collaborator: CollaboratorAccess | null = null;

  if (user) {
    const { data } = await supabase
      .from("collaborators")
      .select("role, is_active, view_permissions")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    collaborator = data as CollaboratorAccess | null;
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    if (collaborator?.is_active) {
      const permissions = normalizeViewPermissions(collaborator.role, collaborator.view_permissions);
      const target = firstAllowedPath(collaborator.role, permissions);
      if (target !== "/login") {
        url.pathname = target;
        return NextResponse.redirect(url);
      }
      return response;
    }
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (user && collaborator && !isPublicRoute) {
    if (!collaborator.is_active) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    const permissions = normalizeViewPermissions(collaborator.role, collaborator.view_permissions);
    const requiredPermission = permissionForPath(pathname);
    const target = firstAllowedPath(collaborator.role, permissions);
    const isOwnValeRoute = pathname === "/meu-vale" || pathname.startsWith("/meu-vale/");
    const isAllowedRoute = isOwnValeRoute || (requiredPermission !== null && permissions.includes(requiredPermission));

    if (!isAllowedRoute && target !== pathname && target !== "/login") {
      const url = request.nextUrl.clone();
      url.pathname = target;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
