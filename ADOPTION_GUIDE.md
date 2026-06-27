# Adoption guide — getServiceClient() and apiError()

Two new primitives, both ADDITIVE and zero-risk. Existing routes keep working
untouched; migrate incrementally.

## 1. getServiceClient()  (lib/supabase.ts)
Replaces inline `createClient(url, SERVICE_ROLE_KEY)` in routes. Same hardened
config as the shared `supabaseAdmin` (no session persistence / token refresh).

BEFORE:
    import { createClient } from '@supabase/supabase-js'
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

AFTER:
    import { getServiceClient } from '@/lib/supabase'
    const supabase = getServiceClient('route/name')

(Or just `import { supabaseAdmin } from '@/lib/supabase'` if you only need the
shared instance.)

~54 routes still construct a "bare" inline client (missing persistSession:false).
Each is a one-line swap. Demonstrated in: app/api/admin/users/route.ts

## 2. apiError()  (lib/apiError.ts)
Replaces `return NextResponse.json({ error: error.message }, { status: 500 })`,
which leaked internal detail (table/column/constraint text) to the client.
Logs full detail server-side + Sentry; returns a generic safe message.

BEFORE:
    } catch (error: any) {
      console.error('X error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

AFTER:
    } catch (error) {
      return apiError(error, { route: 'route/name' })
    }

Response shape is unchanged ({ success:false, error:<string> }), so clients that
read data.error keep working. ~79 routes leak raw error.message today.
Demonstrated in: app/api/calls/outbound/route.ts, app/api/admin/users/route.ts

## 3. Statement timeout (already applied to the DB)
service_role now has statement_timeout=30s. No code change needed; it guards
every service-role query. See migrations/SERVICE_ROLE_TIMEOUT_2026-06-27.sql
