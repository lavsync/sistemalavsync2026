"use client";

import { useState } from "react";
import { Keyboard, X } from "lucide-react";
import { Button } from "@mi/components/ui/button";

const SHORTCUTS: { keys: string[]; label: string; category: string }[] = [
  { keys: ["⌘", "S"], label: "Salvar template", category: "Geral" },
  { keys: ["⌘", "Z"], label: "Desfazer", category: "Geral" },
  { keys: ["⌘", "⇧", "Z"], label: "Refazer", category: "Geral" },
  { keys: ["Esc"], label: "Desselecionar / Fechar preview", category: "Geral" },

  { keys: ["⌘", "D"], label: "Duplicar elemento selecionado", category: "Elementos" },
  { keys: ["Del"], label: "Excluir elemento selecionado", category: "Elementos" },
  { keys: ["←", "→", "↑", "↓"], label: "Mover 8px (com snap)", category: "Elementos" },
  { keys: ["⇧", "←/→/↑/↓"], label: "Mover 32px (com snap)", category: "Elementos" },

  { keys: ["Clique"], label: "Selecionar elemento", category: "Mouse" },
  { keys: ["Arrastar"], label: "Mover elemento", category: "Mouse" },
  { keys: ["Drag handles"], label: "Redimensionar", category: "Mouse" },
  { keys: ["Bolinha topo"], label: "Rotacionar (snap 15°)", category: "Mouse" },
];

const GROUPED = SHORTCUTS.reduce<Record<string, typeof SHORTCUTS>>((acc, s) => {
  if (!acc[s.category]) acc[s.category] = [];
  acc[s.category].push(s);
  return acc;
}, {});

export function ShortcutsCheatSheet() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="border-white/10 bg-white/5 text-white hover:bg-white/10"
        title="Atalhos de teclado"
      >
        <Keyboard className="h-3 w-3" />
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-[200] grid place-items-center bg-black/80 backdrop-blur-md p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0f14] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-full bg-white/5 p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Editor de templates</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Atalhos de teclado</h2>
              <p className="mt-1 text-sm text-white/50">Dominar o editor em 30 segundos.</p>
            </div>

            {Object.entries(GROUPED).map(([category, items]) => (
              <div key={category} className="mb-5">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/40">{category}</p>
                <div className="space-y-2">
                  {items.map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-4">
                      <span className="text-sm text-white/80">{s.label}</span>
                      <div className="flex items-center gap-1">
                        {s.keys.map((k, ki) => (
                          <kbd
                            key={ki}
                            className="rounded-md border border-white/20 bg-white/5 px-2 py-1 text-[11px] font-mono font-semibold text-white"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <p className="mt-6 rounded-lg bg-primary/10 p-3 text-xs text-primary">
              💡 <strong>Dica:</strong> Em qualquer momento, aperte <kbd className="rounded bg-white/10 px-1 font-mono">?</kbd> para abrir esta tela.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
