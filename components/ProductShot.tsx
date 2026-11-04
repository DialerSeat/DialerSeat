'use client'
import Image from 'next/image'
import { t } from '@/lib/i18n/client'
import type { Shot } from '@/lib/screenshots'

// =============================================================================
// One product capture, dropped into a page that is talking about that screen.
// =============================================================================
// A client component only so that the /dialing-modes and /faq/white-label
// views, which are 'use client' from their first line, can use the same one as
// the server pages. It holds no state: tap-to-enlarge is an ordinary link
// rather than a lightbox, so a crawler sees a plain <img> inside an <a>.
//
// MOBILE IS THE WHOLE DESIGN PROBLEM HERE. These are 1919px dashboards. On a
// 375px phone the column is about 297px wide, so the picture lands at roughly
// a sixth of its real size: enough to read as "a dense, real product", not
// nearly enough to read. Showing a cropped corner instead would be worse,
// because then it is not the product any more. So the whole frame stays
// visible and the image links to the full-resolution file, which is what
// somebody actually does when they want to look closer.
// =============================================================================

export default function ProductShot({
  shot,
  caption,
  priority = false,
}: {
  shot: Shot
  /** Override the manifest's caption, which is written for /screenshots and is
   *  usually the wrong length for a page that already explained the screen.
   *  Pass null for no caption at all. */
  caption?: string | null
  priority?: boolean
}) {
  const text = caption === undefined ? shot.caption : caption

  return (
    <figure className="pshot">
      <a
        href={shot.src}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("Open this screenshot at full size")}
      >
        <Image
          src={shot.src}
          alt={t(shot.alt)}
          width={shot.width}
          height={shot.height}
          priority={priority}
          sizes="(max-width: 900px) 100vw, 900px"
        />
      </a>
      {text ? (
        <figcaption>
          {t(text)}
          <span className="pshot-hint"> {t("Tap it to see it full size.")}</span>
        </figcaption>
      ) : null}
      <style>{`
        .pshot { margin: 22px 0; }
        .pshot a { display: block; border: 1px solid #c4c8d0; border-radius: 8px; overflow: hidden; }
        .pshot img { width: 100%; height: auto; display: block; }
        .pshot figcaption { margin-top: 12px; font-size: 15px; line-height: 1.6; color: #4a5160; }
        .pshot-hint { color: #8a90a0; }
        /* A mouse can already open it in a new tab and knows it; the line is
           for a thumb, which cannot tell the picture is a link. */
        @media (hover: hover) { .pshot-hint { display: none; } }
      `}</style>
    </figure>
  )
}
