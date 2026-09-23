import type { GlobeTheme } from "../lib/globeTheme";

/**
 * A globe in miniature: enough of the palette to tell them apart at a glance.
 *
 * Sized by the caller, and everything inside it is a percentage rather than a
 * fixed number of pixels, so the same swatch works at 48px on the palette
 * picker and at 20px inside a button without the two dots swallowing it.
 */
export default function PaletteSwatch({
  theme,
  className = "h-12 w-12",
}: {
  theme: GlobeTheme;
  className?: string;
}) {
  const { palette } = theme;
  return (
    <span
      aria-hidden="true"
      className={`relative block shrink-0 overflow-hidden rounded-full border border-white/15 ${className}`}
      style={{ backgroundColor: palette.sphere }}
    >
      <span
        className="absolute inset-x-0 top-0 block h-1/2"
        style={{ backgroundColor: palette.idle }}
      />
      <span
        className="absolute bottom-[8%] left-[8%] block h-[21%] w-[21%] rounded-full"
        style={{ backgroundColor: palette.found }}
      />
      <span
        className="absolute bottom-[8%] right-[8%] block h-[21%] w-[21%] rounded-full"
        style={{ backgroundColor: palette.missed }}
      />
    </span>
  );
}
