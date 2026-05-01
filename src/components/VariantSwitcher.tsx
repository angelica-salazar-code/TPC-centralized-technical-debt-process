import { useEffect } from "react";
import { Activity, Gem } from "lucide-react";
import { useAppState, type Variant } from "@/lib/appState";

const variants: { id: Variant; name: string; tagline: string; Icon: typeof Activity }[] = [
  { id: "council", name: "Council", tagline: "Decision room", Icon: Gem },
  // Signal and Atlas hidden from switcher (files retained).
];

export function VariantSwitcher() {
  const { variant, setVariant } = useAppState();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.target instanceof HTMLElement)) return;
      if (!e.target.closest("[data-variant-switcher]")) return;
      const n = variants.length;
      const idx = variants.findIndex((v) => v.id === variant);
      if (idx < 0) return;
      if (e.key === "ArrowRight") setVariant(variants[(idx + 1) % n].id);
      if (e.key === "ArrowLeft") setVariant(variants[(idx + n - 1) % n].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant, setVariant]);

  return (
    <div className="meta-band sticky top-0 z-50 w-full" data-variant-switcher>
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold tracking-[0.2em] text-white/60">CONCEPT</span>
          <span className="text-white/40">Cross-SBU Tech Debt Prioritization</span>
        </div>
        <div role="tablist" aria-label="Design variant" className="flex gap-1 rounded-md bg-white/5 p-1">
          {variants.map((v) => {
            const active = variant === v.id;
            const Icon = v.Icon;
            return (
              <button
                key={v.id}
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => setVariant(v.id)}
                className={`flex items-center gap-2 rounded px-3 py-1.5 text-[11px] font-medium tracking-wide transition-colors ${
                  active ? "bg-white text-black" : "text-white/70 hover:bg-white/10"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{v.name}</span>
                <span className="hidden text-white/40 md:inline">— {v.tagline}</span>
              </button>
            );
          })}
        </div>
        <div className="hidden text-white/40 md:block">←/→ to switch</div>
      </div>
    </div>
  );
}
