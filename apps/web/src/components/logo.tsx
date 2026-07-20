import { clsx } from "clsx";

// The brand mark. Served as a pre-sized PNG through a plain <img> rather than
// next/image: sharp isn't installed, so the optimizer would fail at runtime in
// production, and a 24px mark gains nothing from it anyway.
//
// The artwork carries its own corner radius and transparent-trimmed edges, so
// it needs no wrapper tile or CSS rounding.
export function Logo({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-64.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={clsx("shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}
