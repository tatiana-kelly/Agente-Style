import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_PATHS = ['/login', '/auth']

/**
 * Renova a sessão e protege as rotas.
 * Sem Supabase configurado o app roda em modo demo e o proxy sai do caminho.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(items) {
        for (const { name, value } of items) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of items) response.cookies.set(name, value, options)
      },
    },
  })

  // getUser revalida o token no servidor; getSession apenas lê o cookie.
  const { data } = await supabase.auth.getUser()
  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p))

  if (!data.user && !isPublic) {
    const redirect = request.nextUrl.clone()
    redirect.pathname = '/login'
    redirect.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(redirect)
  }

  if (data.user && request.nextUrl.pathname === '/login') {
    const redirect = request.nextUrl.clone()
    redirect.pathname = '/'
    redirect.search = ''
    return NextResponse.redirect(redirect)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|demo/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
