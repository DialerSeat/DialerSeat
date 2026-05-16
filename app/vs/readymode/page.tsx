import type { Metadata } from 'next'
import VsReadyModeView from './view'

export const metadata: Metadata = {
  title: 'DialerSeat vs ReadyMode — Modern Dialer for High-Volume Teams',
  description:
    'DialerSeat is the modern alternative to ReadyMode. Multi-line predictive, live coaching, AI transcription, CRM integrations — at flat $140/seat. No $2K setup fee, no demo, no annual contract.',
}

export default function Page() {
  return <VsReadyModeView />
}