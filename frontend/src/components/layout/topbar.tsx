"use client";

import { Bell, Search, Menu, PanelsTopLeft, LogOut, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrbitLogo } from "@/components/brand/orbit-logo";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar({
  onOpenCommand,
  breadcrumb,
  className,
}: {
  onOpenCommand: () => void;
  breadcrumb?: ReactNode;
  className?: string;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/70 px-4 backdrop-blur-xl sm:px-6",
        className,
      )}
    >
      <Button variant="ghost" size="icon" aria-label="Abrir menu" className="lg:hidden">
        <Menu className="size-4" />
      </Button>
      <div className="lg:hidden">
        <OrbitLogo variant="mark" />
      </div>

      <div className="hidden min-w-0 flex-1 md:block">{breadcrumb}</div>

      <button
        type="button"
        onClick={onOpenCommand}
        aria-label="Abrir busca global (Command K)"
        className="glass ml-auto flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground md:w-72"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden md:inline">Buscar em tudo…</span>
        <kbd className="ml-auto hidden rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] md:inline">
          ⌘K
        </kbd>
      </button>

      <Button variant="ghost" size="icon" aria-label="Notificações" className="relative">
        <Bell className="size-4" />
        <span className="bg-gradient-orbit absolute top-2 right-2 size-2 rounded-full" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Alternar painéis" className="hidden sm:flex">
        <PanelsTopLeft className="size-4" />
      </Button>

      <div className="flex items-center gap-2 pl-1">
        <Badge variant="outline" className="hidden lg:inline-flex">
          Workspace
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="size-8 ring-1 ring-border">
                <AvatarFallback className="bg-gradient-orbit text-xs font-semibold text-primary-foreground">
                  OR
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <UserRound className="size-4" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={logout} className="text-destructive focus:text-destructive">
              <LogOut className="size-4" />
              Encerrar sessão
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
