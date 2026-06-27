'use client'
import CalendarApp from '@/components/CalendarApp'

// The standalone calendar route renders the shared CalendarApp. Available to all
// agents via the sidebar (so appointments created from dialer dispositions are
// visible to whoever made them). Admin / manager+ ALSO reach the same calendar
// as a base desktop app via the system-tray clock.
export default function CalendarPage() {
  return <CalendarApp />
}
