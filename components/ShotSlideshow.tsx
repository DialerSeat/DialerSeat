'use client'
import { useState } from 'react'
import Image from 'next/image'
import { SITE } from '@/lib/siteTheme'
import { t } from '@/lib/i18n/client'
import type { Shot } from '@/lib/screenshots'

// =============================================================================
// A slideshow of product captures.
// =============================================================================
// EVERY SLIDE IS IN THE DOM, and the inactive ones are hidden with CSS rather
// than unmounted. A carousel that mounts only the current slide shows a
// crawler one image out of ten, and the entire reason these captures were
// published is that machines could not find pictures of the product. The
// arrows move a class, not the markup.
//
// `priority` on the first slide only: ten full-width PNGs all marked priority
// would fight each other and the page's own hero for bandwidth.
//
// One implementation, used by /screenshots and /partners. Two copies of a
// carousel is how one of them quietly goes back to unmounting its slides.
// =============================================================================

// Classes are prefixed `shotshow-`, not `wl-`. /faq/white-label already owns
// a dozen `wl-` classes of its own (wl-price, wl-math, wl-included...) and now
// renders this component, and this <style> block is global. A future `wl-stage`
// added over there would silently restyle a slideshow on three other pages.
export default function ShotSlideshow({
  shots,
  captions = false,
}: {
  shots: Shot[]
  /** Show each slide's title and caption underneath. White-label themes carry
   *  neither, so the stage stands alone there. */
  captions?: boolean
}) {
  const [idx, setIdx] = useState(0)
  const count = shots.length
  const go = (d: number) => setIdx((i) => (i + d + count) % count)
  const active = shots[idx]

  return (
    <div className="shotshow">
      <style>{`
        .shotshow { margin: 8px 0 4px; }
        .shotshow-stage {
          position: relative;
          border: 1px solid ${SITE.border};
          border-radius: 8px;
          overflow: hidden;
          background: ${SITE.surface};
          aspect-ratio: 1919 / 991;
        }
        .shotshow-slide { position: absolute; inset: 0; opacity: 0; transition: opacity .25s ease; }
        .shotshow-slide[data-on="1"] { opacity: 1; }
        .shotshow-slide img { width: 100%; height: 100%; object-fit: cover; object-position: top center; }
        .shotshow-arrow {
          position: absolute; top: 50%; transform: translateY(-50%);
          width: 42px; height: 42px; border-radius: 50%;
          border: 1px solid ${SITE.border}; background: rgba(255,255,255,0.92);
          color: ${SITE.text}; font-size: 22px; line-height: 1; cursor: pointer;
          display: flex; align-items: center; justify-content: center; z-index: 2;
        }
        .shotshow-arrow:hover { background: #fff; border-color: ${SITE.deep}; }
        .shotshow-arrow.l { inset-inline-start: 10px; }
        .shotshow-arrow.r { inset-inline-end: 10px; }
        .shotshow-dots { display: flex; gap: 2px; justify-content: center; flex-wrap: wrap; margin-top: 8px; }
        /* ── A 9px DOT WITH A 24px TOUCH TARGET ───────────────────────────
           The button was the dot: 9 by 9, well under the 44px Apple and the
           48px Material both ask for, and on a ten-theme row that is ten
           targets a thumb cannot hit. The button is now 24 square and
           transparent; the dot is drawn inside it. */
        .shotshow-dot {
          width: 24px; height: 24px; border: 0; padding: 0; cursor: pointer;
          background: transparent; position: relative;
        }
        .shotshow-dot::before {
          content: ''; position: absolute; top: 50%; left: 50%;
          width: 9px; height: 9px; margin: -5px 0 0 -5px; border-radius: 50%;
          border: 1px solid ${SITE.border}; background: transparent;
        }
        .shotshow-dot[data-on="1"]::before { background: ${SITE.deep}; border-color: ${SITE.deep}; }
        /* The whole stage is a link to the full-resolution file. A 1919px
           dashboard drawn 297px wide on a phone is a grey smudge; this is
           how somebody reads it. */
        .shotshow-zoom { position: absolute; inset: 0; z-index: 1; display: block; }
        .shotshow-hint {
          text-align: center; font-size: 11px; letter-spacing: 1.5px;
          text-transform: uppercase; color: ${SITE.muted}; margin-top: 10px;
        }
        .shotshow-count {
          text-align: center; font-size: 12px; letter-spacing: 2px;
          color: ${SITE.muted}; margin-top: 10px;
        }
        /* Reserved height, so stepping between a short caption and a long one
           does not jump the rest of the page under the reader's cursor. */
        .shotshow-cap { margin-top: 16px; min-height: 124px; }
        .shotshow-cap h3 { margin: 0 0 6px; font-size: 18px; }
        .shotshow-cap p { margin: 0; }
        @media (max-width: 640px) {
          /* 44px, not 34. These sit ON the image, so an undersized arrow on a
             phone means tapping the picture instead of the control. */
          .shotshow-arrow { width: 44px; height: 44px; font-size: 20px; }
          .shotshow-arrow.l { inset-inline-start: 6px; }
          .shotshow-arrow.r { inset-inline-end: 6px; }
          .shotshow-cap { min-height: 200px; }
        }
        /* Pointer-coarse rather than width: a small laptop does not need the
           hint, and a large phone does. */
        @media (hover: hover) { .shotshow-hint { display: none; } }
      `}</style>

      <div className="shotshow-stage">
        <button className="shotshow-arrow l" onClick={() => go(-1)} aria-label={t("Previous")}>‹</button>
        {shots.map((s, i) => (
          <div className="shotshow-slide" data-on={i === idx ? '1' : '0'} key={s.src} aria-hidden={i !== idx}>
            <Image
              src={s.src}
              alt={t(s.alt)}
              width={s.width}
              height={s.height}
              priority={i === 0}
              sizes="(max-width: 900px) 100vw, 900px"
            />
          </div>
        ))}
        <a
          className="shotshow-zoom"
          href={active.src}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("Open this screenshot at full size")}
        />
        <button className="shotshow-arrow r" onClick={() => go(1)} aria-label={t("Next")}>›</button>
      </div>
      <div className="shotshow-hint">{t("Tap the image to see it full size")}</div>

      <div className="shotshow-dots">
        {shots.map((s, i) => (
          <button
            key={s.src}
            className="shotshow-dot"
            data-on={i === idx ? '1' : '0'}
            onClick={() => setIdx(i)}
            aria-label={t("Slide {n}", { n: String(i + 1) })}
          />
        ))}
      </div>
      <div className="shotshow-count">{t("{n} OF {total}", { n: String(idx + 1), total: String(count) })}</div>

      {captions && active && (
        <div className="shotshow-cap">
          {active.title && <h3>{t(active.title)}</h3>}
          {active.caption && <p>{t(active.caption)}</p>}
        </div>
      )}
    </div>
  )
}
