type Props = {
  data: object
}

/**
 * Renders a JSON-LD script tag for Schema.org structured data.
 * Server component — pre-rendered into HTML so Google and AI crawlers
 * see it on first fetch without executing JavaScript.
 */
export default function JsonLd({ data }: Props) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}