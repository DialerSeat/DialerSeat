'use client'
// The billing page can be shown as a popup over the dashboard (see
// components/onboarding). Inside one, Cancel closes the popup instead of
// abandoning the checkout and signing the person out.
import { createContext, useContext } from 'react'

export const BillingOverlayContext = createContext<{ close: () => void } | null>(null)
export function useBillingOverlay() { return useContext(BillingOverlayContext) }
