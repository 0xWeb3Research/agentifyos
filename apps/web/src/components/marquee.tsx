import { LogoTile } from "./ui";
import type { ToolWithStats } from "@/lib/types";

// Auto-scrolling wall of tool tiles — instant "this market has inventory".
// CSS-only (translateX -50% over a doubled track), pauses on hover.
export function Marquee({ tools }: { tools: ToolWithStats[] }) {
  const track = [...tools, ...tools];
  return (
    <div
      className="relative overflow-hidden py-1"
      style={{
        maskImage:
          "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
      }}
    >
      <div className="flex w-max animate-marquee gap-2.5 hover:[animation-play-state:paused]">
        {track.map((t, i) => (
          <div
            key={`${t.id}-${i}`}
            className="flex items-center gap-2.5 rounded-[var(--radius-pill)] border border-border bg-surface py-1.5 pl-1.5 pr-4"
          >
            <LogoTile monogram={t.monogram} color={t.color} size={28} />
            <span className="whitespace-nowrap text-[13px] font-medium">{t.name}</span>
            <span className="stat whitespace-nowrap text-muted">{t.category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
