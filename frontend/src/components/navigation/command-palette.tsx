"use client";

import { useEffect } from "react";
import {
  Calculator,
  Boxes,
  FileBarChart,
  Settings,
  Users,
  Workflow,
  Sparkles,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

export function useCommandPalette(open: boolean, setOpen: (v: boolean) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar módulos, registros e ações…" />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        <CommandGroup heading="Navegação">
          <CommandItem>
            <Workflow className="size-4" /> Operações
            <CommandShortcut>⌘1</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Boxes className="size-4" /> Inventário
            <CommandShortcut>⌘2</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Users className="size-4" /> Pessoas
            <CommandShortcut>⌘3</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <FileBarChart className="size-4" /> Relatórios
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Ações">
          <CommandItem>
            <Sparkles className="size-4" /> Criar novo registro
          </CommandItem>
          <CommandItem>
            <Calculator className="size-4" /> Abrir calculadora
          </CommandItem>
          <CommandItem>
            <Settings className="size-4" /> Preferências
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
