"use client";

const logoAsset = { url: "/orbit_logo.png" };
import { cn } from "@/lib/utils";

type OrbitLogoProps = {
  /** full lockup (mark + wordmark) or compact mark plate */
  variant?: "full" | "mark";
  className?: string;
};

/**
 * Official Orbit logo. Never redraw or recolor it — the artwork is navy on
 * light, so it sits on a light plate: white in the light theme, and a light
 * plate in dark mode to keep contrast.
 */
export function OrbitLogo({ variant = "full", className }: OrbitLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center overflow-hidden rounded-xl bg-card shadow-soft ring-1 ring-border dark:bg-foreground/95",
        variant === "full" ? "h-11 w-40 px-3" : "h-10 w-10",
        className,
      )}
    >

      <img
        src={logoAsset.url}
        alt="Orbit Operations ERP"
        className={cn(
          "object-contain",
          variant === "full" ? "h-full w-full" : "h-9 w-9 scale-[2.1] object-left",
        )}
        style={variant === "mark" ? { objectPosition: "22% 50%" } : undefined}
      />
    </span>
  );
}
