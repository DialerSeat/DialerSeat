import type { MouseEvent } from 'react'

// =============================================================================
// CLICK-OUTSIDE-TO-CLOSE, WITHOUT THE DRAG BUG
// =============================================================================
// A backdrop with `onClick={close}` closes when it should not, and the case is
// common enough to hit daily: select text inside the dialog, drag past its
// edge, release. The mouseup lands on the backdrop, so the browser fires
// `click` on the nearest common ancestor — the backdrop — and the dialog
// vanishes mid-selection, discarding whatever was being edited.
//
// Checking `e.target === e.currentTarget` inside onClick is the usual attempt
// and it does not help: on a drag-out the click's target genuinely IS the
// backdrop. The press has to be checked too. A dismissal is only real when the
// gesture both STARTED and ENDED on the backdrop.
//
// Module-level rather than a hook so it can be used inline in JSX next to a
// conditionally-rendered dialog, where hook ordering rules would otherwise
// make it awkward. A single variable is safe because mousedown and click are
// one uninterrupted gesture — there is no second pointer to interleave with.
// =============================================================================

let pressTarget: EventTarget | null = null

/**
 * Props for a modal backdrop that closes on a genuine outside click.
 *
 * Spread onto the backdrop element. The dialog inside still needs its own
 * `onClick={e => e.stopPropagation()}` (or simply to not be the backdrop) so
 * ordinary clicks within it do not bubble up as dismissals.
 *
 *     <div className="modal-overlay" {...overlayDismiss(() => setOpen(false))}>
 *       <div className="modal" onClick={e => e.stopPropagation()}>…</div>
 *     </div>
 *
 * Pass `undefined` to disable dismissal entirely — useful while a save is in
 * flight, where closing would strand the request.
 */
export function overlayDismiss(onDismiss: (() => void) | undefined) {
  return {
    onMouseDown: (e: MouseEvent) => {
      pressTarget = e.target
    },
    onClick: (e: MouseEvent) => {
      const started = pressTarget
      pressTarget = null
      if (!onDismiss) return
      // Both ends of the gesture must be the backdrop itself. A press that
      // began on the dialog — or on anything inside it — is a drag, not a
      // dismissal, however far outside it finished.
      if (started === e.currentTarget && e.target === e.currentTarget) {
        onDismiss()
      }
    },
  }
}
