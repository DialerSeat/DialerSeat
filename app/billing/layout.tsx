export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Routing to /welcome is decided in one place only: app/welcome/page.tsx.
// This layout used to re-run that same shouldSeeWelcome() check on every
// /billing visit and bounce back to /welcome, guarded by a fragile
// referer/x-invoke-path sniff meant to detect "did we just come from
// welcome". That guard doesn't reliably hold (no referer after a Stripe
// redirect or router.push, and nothing ever sets x-invoke-path), so it
// could send a user on /billing back to /welcome, which immediately sends
// them back to /billing, forever. /billing should just render — anyone
// who needs to see /welcome first is already routed there by /welcome's
// own logic (or by whatever link/redirect sent them to sign up).
export default function BillingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}