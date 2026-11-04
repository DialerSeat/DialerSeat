'use client'
import ShotSlideshow from '@/components/ShotSlideshow'
import { WHITE_LABEL_SHOTS } from '@/lib/screenshots'

// The white-label slideshow is now one shared implementation, in
// components/ShotSlideshow. /partners runs two of them, and two copies of a
// carousel is how one of them quietly goes back to unmounting its slides and
// showing a crawler one image out of ten.
export default function WhiteLabelSlideshow() {
  return <ShotSlideshow shots={WHITE_LABEL_SHOTS} />
}
