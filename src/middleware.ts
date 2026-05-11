import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const handleI18nRouting = createMiddleware(routing);

export async function middleware(request: NextRequest) {
    // 1. Handle i18n routing first
    const i18nResponse = handleI18nRouting(request);

    // E2E testing bypass — skip auth when BYPASS_AUTH is set
    // NEVER enable this in production deployments
    if (process.env.BYPASS_AUTH === 'true') {
        return i18nResponse;
    }

    // 2. Prepare Supabase client
    let supabaseResponse = i18nResponse;

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    // Copy i18n headers/cookies if any
                    i18nResponse.headers.forEach((v, k) => supabaseResponse.headers.set(k, v));
                    
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname;
    
    // Helper to check if pathname matches protected routes (with or without locale)
    const isProtectedPath = (path: string) => {
        const unprotectedPaths = ['/login', '/api', '/_next', '/favicon.ico'];
        // Remove locale prefix for checking
        const pathWithoutLocale = path.replace(/^\/(en|ar)(\/|$)/, '/');
        
        if (unprotectedPaths.some(p => pathWithoutLocale.startsWith(p))) return false;
        
        const protectedRoots = ['/dashboard', '/inventory', '/sales', '/invoices', '/profits', '/staff-sales', '/logs', '/users', '/expenses', '/refunds'];
        return pathWithoutLocale === '/' || protectedRoots.some(p => pathWithoutLocale.startsWith(p));
    };

    const isProtectedRoute = isProtectedPath(pathname);
    const isLoginPage = pathname.replace(/^\/(en|ar)(\/|$)/, '/') === '/login';

    if (isProtectedRoute && !user) {
        // Redirect to login with current locale if possible
        const localeMatch = pathname.match(/^\/(en|ar)/);
        const locale = localeMatch ? localeMatch[0] : '';
        return NextResponse.redirect(new URL(`${locale}/login`, request.url))
    }

    if (isLoginPage && user) {
        const localeMatch = pathname.match(/^\/(en|ar)/);
        const locale = localeMatch ? localeMatch[0] : '';
        return NextResponse.redirect(new URL(`${locale}/dashboard`, request.url))
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - logo.webp, logo.jpg (public assets)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
