// BrandLogo — the EXACT same icon as the favicon, used everywhere
// in the UI for brand consistency.
//
// Source of truth: /public/favicon.svg (this is the inlined version).
// When the favicon SVG changes, this component MUST be updated to match.

type BrandLogoProps = {
  size?: number
  className?: string
}

export function BrandLogo({ size = 32, className }: BrandLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="brand-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="url(#brand-bg)" />
      <circle cx="13" cy="13" r="7" fill="#ffffff" />
      <circle cx="13" cy="13" r="7" fill="none" stroke="#059669" strokeWidth="1.4" />
      <circle cx="13" cy="13" r="2.4" fill="#059669" />
      <line x1="18" y1="18" x2="26.5" y2="26.5" stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  )
}

export default BrandLogo
