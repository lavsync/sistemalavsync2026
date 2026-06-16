import { cn } from "@mi/lib/utils";

export function FieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/40", className)}>
      {children}
    </label>
  );
}

export function PropSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary">{title}</p>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

export function NumberInput({
  value, onChange, min, max, step = 1, suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1.5 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-primary">
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 border-0 bg-transparent text-xs text-white outline-none tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {suffix && <span className="text-[10px] text-white/40">{suffix}</span>}
    </div>
  );
}

export function TextInput({
  value, onChange, placeholder, multiline = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-md border-0 bg-white/5 px-3 py-2 text-xs text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-primary"
      />
    );
  }
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border-0 bg-white/5 px-3 py-2 text-xs text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-primary"
    />
  );
}

export function SelectInput({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border-0 bg-white/5 px-3 py-2 text-xs text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-primary"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[#0a0f14]">
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function ColorInput({
  value, onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-white/5 p-1.5 ring-1 ring-white/10">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 border-0 bg-transparent text-xs font-mono text-white outline-none"
      />
    </div>
  );
}
