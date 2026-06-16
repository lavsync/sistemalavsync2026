export function PanelHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-white/10 px-4 py-4">
      <h2 className="text-sm font-bold uppercase tracking-widest text-white">{title}</h2>
      {subtitle && <p className="mt-1 text-[11px] text-white/50">{subtitle}</p>}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-widest text-white/40">
      {children}
    </p>
  );
}
