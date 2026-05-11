import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    // E2E testing bypass — skip auth when BYPASS_AUTH is set
    // NEVER enable this in production deployments
    if (process.env.BYPASS_AUTH === 'true') {
        return NextResponse.next({
            request: { headers: request.headers },
        })
    }

    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

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
                    response = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Protected routes: everything under /dashboard
    const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard') ||
        request.nextUrl.pathname === '/' ||
        request.nextUrl.pathname.startsWith('/inventory') ||
        request.nextUrl.pathname.startsWith('/sales') ||
        request.nextUrl.pathname.startsWith('/invoices') ||
        request.nextUrl.pathname.startsWith('/profits') ||
        request.nextUrl.pathname.startsWith('/staff-sales') ||
        request.nextUrl.pathname.startsWith('/logs') ||
        request.nextUrl.pathname.startsWith('/users') ||
        request.nextUrl.pathname.startsWith('/expenses');

    if (isProtectedRoute && !user) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // Auth routes: redirect to dashboard if already logged in
    if (request.nextUrl.pathname === '/login' && user) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return response
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
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
