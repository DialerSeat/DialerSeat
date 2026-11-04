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
    <div className="wl">
      <style>{`
        .wl { margin: 8px 0 4px; }
        .wl-stage {
          position: relative;
          border: 1px solid ${SITE.border};
          border-radius: 8px;
          overflow: hidden;
          background: ${SITE.surface};
          aspect-ratio: 1919 / 991;
        }
        .wl-slide { position: absolute; inset: 0; opacity: 0; transition: opacity .25s ease; }
        .wl-slide[data-on="1"] { opacity: 1; }
        .wl-slide img { width: 100%; height: 100%; object-fit: cover; object-position: top center; }
        .wl-arrow {
          position: absolute; top: 50%; transform: translateY(-50%);
          width: 42px; height: 42px; border-radius: 50%;
          border: 1px solid ${SITE.border}; background: rgba(255,255,255,0.92);
          color: ${SITE.text}; font-size: 22px; line-height: 1; cursor: pointer;
          display: flex; align-items: center; justify-content: center; z-index: 2;
        }
        .wl-arrow:hover { background: #fff; border-color: ${SITE.deep}; }
        .wl-arrow.l { inset-inline-start: 10px; }
        .wl-arrow.r { inset-inline-end: 10px; }
        .wl-dots { display: flex; gap: 7px; justify-content: center; flex-wrap: wrap; margin-top: 14px; }
        .wl-dot {
          width: 9px; height: 9px; border-radius: 50%; padding: 0; cursor: pointer;
          border: 1px solid ${SITE.border}; background: transparent;
        }
        .wl-dot[data-on="1"] { background: ${SITE.deep}; border-color: ${SITE.deep}; }
        .wl-count {
          text-align: center; font-size: 12px; letter-spacing: 2px;
          color: ${SITE.muted}; margin-top: 10px;
        }
        /* Reserved height, so stepping between a short caption and a long one
           does not jump the rest of the page under the reader's cursor. */
        .wl-cap { margin-top: 16px; min-height: 124px; }
        .wl-cap h3 { margin: 0 0 6px; font-size: 18px; }
        .wl-cap p { margin: 0; }
        @media (max-width: 640px) {
          .wl-arrow { width: 34px; height: 34px; font-size: 18px; }
          .wl-cap { min-height: 180px; }
        }
      `}</style>

      <div className="wl-stage">
        <button className="wl-arrow l" onClick={() => go(-1)} aria-label={t("Previous")}>‹</button>
        {shots.map((s, i) => (
          <div className="wl-slide" data-on={i === idx ? '1' : '0'} key={s.src} aria-hidden={i !== idx}>
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
        <button className="wl-arrow r" onClick={() => go(1)} aria-label={t("Next")}>›</button>
      </div>

      <div className="wl-dots">
        {shots.map((s, i) => (
          <button
            key={s.src}
            className="wl-dot"
            data-on={i === idx ? '1' : '0'}
            onClick={() => setIdx(i)}
            aria-label={t("Slide {n}", { n: String(i + 1) })}
          />
        ))}
      </div>
      <div className="wl-count">{t("{n} OF {total}", { n: String(idx + 1), total: String(count) })}</div>

      {captions && active && (
        <div className="wl-cap">
          {active.title && <h3>{t(active.title)}</h3>}
          {active.caption && <p>{t(active.caption)}</p>}
        </div>
      )}
    </div>
  )
}
