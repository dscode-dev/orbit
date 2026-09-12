"use client";

import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppProviders } from "@/providers";
import { SidebarPreferenceProvider } from "@/components/layout/sidebar-preference";

export function Providers({
  children,
  sidebarCollapsed = true,
}: {
  children: ReactNode;
  /** Resolvida no layout raiz, a partir do cookie. */
  sidebarCollapsed?: boolean;
}) {
  return (
    <AppProviders>
      <TooltipProvider delayDuration={200}>
        {/* No layout raiz, e não no shell: o shell é montado por página e
            remonta a cada navegação, que é o que zerava a escolha. */}
        <SidebarPreferenceProvider initialCollapsed={sidebarCollapsed}>
          {children}
        </SidebarPreferenceProvider>
        <Toaster />
      </TooltipProvider>
    </AppProviders>
  );
}
