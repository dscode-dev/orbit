"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Max-width, padded content container used by every page body. */
export function ContentContainer({
  children,
  className,
  size = "default",
}: {
  children: ReactNode;
  className?: string;
  size?: "default" | "wide" | "narrow";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-6 sm:px-6 lg:px-8",
        size === "narrow" && "max-w-3xl",
        size === "default" && "max-w-7xl",
        size === "wide" && "max-w-[110rem]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Page-level header: title, description and actions. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Section header used inside a page to separate content blocks. */
export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="space-y-1">
        <h2 className="font-display text-sm font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted-foreground/80">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

/** Two-column split layout that collapses on tablet and below. */
export function SplitLayout({
  primary,
  secondary,
  className,
  ratio = "2/1",
}: {
  primary: ReactNode;
  secondary: ReactNode;
  className?: string;
  ratio?: "1/1" | "2/1" | "3/1";
}) {
  return (
    <div
      className={cn(
        "grid gap-6",
        ratio === "1/1" && "lg:grid-cols-2",
        ratio === "2/1" && "lg:grid-cols-3",
        ratio === "3/1" && "lg:grid-cols-4",
        className,
      )}
    >
      <div
        className={cn(
          ratio === "2/1" && "lg:col-span-2",
          ratio === "3/1" && "lg:col-span-3",
          "min-w-0",
        )}
      >
        {primary}
      </div>
      <div className="min-w-0">{secondary}</div>
    </div>
  );
}

/** Scrollable panel with a fixed height and themed scrollbar. */
export function ScrollablePanel({
  children,
  className,
  maxHeight = "24rem",
}: {
  children: ReactNode;
  className?: string;
  maxHeight?: string;
}) {
  return (
    <div className={cn("scroll-panel rounded-xl", className)} style={{ maxHeight }}>
      {children}
    </div>
  );
}
