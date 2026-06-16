"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Check } from "lucide-react";
import { Button } from "@mi/components/ui/button";
import { Input } from "@mi/components/ui/input";
import { Label } from "@mi/components/ui/label";
import { Textarea } from "@mi/components/ui/textarea";
import { Select } from "@mi/components/ui/select";
import { Card, CardContent } from "@mi/components/ui/card";
import { Badge } from "@mi/components/ui/badge";
import { ImageUpload } from "@mi/components/admin/image-upload";
import { CepInput } from "@mi/components/address/cep-input";
import { toast } from "sonner";
import { cn } from "@mi/lib/utils";
import { submitCadastroAction } from "./actions";
import type { Tables } from "@mi/types/database";

const STEPS = [
  { id: 1, label: "Responsável" },
  { id: 2, label: "Empresa" },
  { id: 3, label: "Objetivos" },
  { id: 4, label: "Materiais" },
  { id: 5, label: "Termos" },
];

const OBJECTIVE_OPTIONS = [
  { id: "promocao", label: "Divulgar promoção" },
  { id: "whatsapp", label: "Gerar contatos no WhatsApp" },
  { id: "cupom", label: "Distribuir cupons" },
  { id: "instagram", label: "Crescer no Instagram" },
  { id: "visitas", label: "Aumentar visitas na loja" },
  { id: "clube", label: "Participar do Clube de Benefícios" },
  { id: "evento", label: "Divulgar evento" },
  { id: "outro", label: "Outro objetivo" },
];

interface CadastroForm {
  // Etapa 1
  responsible_name: string;
  responsible_cpf: string;
  responsible_phone: string;
  responsible_email: string;
  responsible_role: string;
  // Etapa 2
  legal_name: string;
  fantasy_name: string;
  cnpj: string;
  company_type: string;
  category_id: string;
  segment_label: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
  google_maps_url: string;
  instagram: string;
  website: string;
  whatsapp_business: string;
  // Etapa 3
  objectives: string[];
  // Etapa 4
  logo_url: string;
  cover_url: string;
  brand_colors: string;
  notes: string;
  // Etapa 5
  terms_accepted: boolean;
}

export function CadastroWizard({
  categories,
  userEmail,
}: {
  categories: Tables<"partner_categories">[];
  userEmail: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<CadastroForm>({
    responsible_name: "",
    responsible_cpf: "",
    responsible_phone: "",
    responsible_email: userEmail,
    responsible_role: "",
    legal_name: "",
    fantasy_name: "",
    cnpj: "",
    company_type: "",
    category_id: "",
    segment_label: "",
    address: "",
    neighborhood: "",
    city: "",
    state: "",
    postal_code: "",
    google_maps_url: "",
    instagram: "",
    website: "",
    whatsapp_business: "",
    objectives: [],
    logo_url: "",
    cover_url: "",
    brand_colors: "",
    notes: "",
    terms_accepted: false,
  });

  const set = <K extends keyof CadastroForm>(key: K, value: CadastroForm[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const toggleObjective = (id: string) =>
    setData((d) => ({
      ...d,
      objectives: d.objectives.includes(id)
        ? d.objectives.filter((o) => o !== id)
        : [...d.objectives, id],
    }));

  const canAdvance = () => {
    if (step === 1) return data.responsible_name.trim().length > 2 && data.responsible_phone.trim().length > 7;
    if (step === 2) return data.fantasy_name.trim().length > 1 && data.category_id !== "";
    if (step === 3) return data.objectives.length > 0;
    if (step === 4) return true; // todos opcionais
    if (step === 5) return data.terms_accepted;
    return false;
  };

  const submit = () => {
    if (!data.terms_accepted) {
      toast.error("Aceite os termos para continuar");
      return;
    }
    startTransition(async () => {
      const res = await submitCadastroAction(data);
      if (res && !res.ok) toast.error(res.error);
    });
  };

  return (
    <Card>
      <CardContent className="space-y-6 p-6 sm:p-8">
        {/* Stepper */}
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
          {STEPS.map((s, idx) => {
            const completed = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex flex-1 items-center gap-2">
                <div
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors",
                    completed && "bg-emerald-500 text-white",
                    active && "bg-primary text-primary-foreground",
                    !completed && !active && "bg-muted text-muted-foreground",
                  )}
                >
                  {completed ? <Check className="h-3.5 w-3.5" /> : s.id}
                </div>
                <span
                  className={cn(
                    "text-[11px] font-medium whitespace-nowrap",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
                {idx < STEPS.length - 1 && (
                  <div className={cn("h-px flex-1", completed ? "bg-emerald-500" : "bg-border")} />
                )}
              </div>
            );
          })}
        </div>

        {/* ─── ETAPA 1 — Responsável ─── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Quem é o responsável?</h2>
              <p className="text-sm text-muted-foreground">
                Dados pessoais de quem vai administrar a conta da empresa.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="responsible_name">Nome completo *</Label>
                <Input
                  id="responsible_name"
                  required
                  value={data.responsible_name}
                  onChange={(e) => set("responsible_name", e.target.value)}
                  placeholder="João Silva"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="responsible_phone">WhatsApp / Telefone *</Label>
                <Input
                  id="responsible_phone"
                  required
                  type="tel"
                  value={data.responsible_phone}
                  onChange={(e) => set("responsible_phone", e.target.value)}
                  placeholder="(31) 99999-9999"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="responsible_cpf">CPF (opcional)</Label>
                <Input
                  id="responsible_cpf"
                  value={data.responsible_cpf}
                  onChange={(e) => set("responsible_cpf", e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="responsible_email">E-mail</Label>
                <Input
                  id="responsible_email"
                  type="email"
                  value={data.responsible_email}
                  onChange={(e) => set("responsible_email", e.target.value)}
                  disabled
                />
                <p className="text-xs text-muted-foreground">E-mail do login (não pode mudar)</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="responsible_role">Cargo / Função</Label>
                <Input
                  id="responsible_role"
                  value={data.responsible_role}
                  onChange={(e) => set("responsible_role", e.target.value)}
                  placeholder="Sócio, gerente, proprietário..."
                />
              </div>
            </div>
          </div>
        )}

        {/* ─── ETAPA 2 — Empresa ─── */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Dados da empresa</h2>
              <p className="text-sm text-muted-foreground">
                Como sua empresa aparece para os clientes Xô Varal.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fantasy_name">Nome fantasia *</Label>
                <Input
                  id="fantasy_name"
                  required
                  value={data.fantasy_name}
                  onChange={(e) => set("fantasy_name", e.target.value)}
                  placeholder="Padaria Pão Quente"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category_id">Categoria *</Label>
                <Select
                  id="category_id"
                  required
                  value={data.category_id}
                  onChange={(e) => set("category_id", e.target.value)}
                >
                  <option value="" disabled>Selecione</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="legal_name">Razão social</Label>
                <Input
                  id="legal_name"
                  value={data.legal_name}
                  onChange={(e) => set("legal_name", e.target.value)}
                  placeholder="Pão Quente Ltda"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={data.cnpj}
                  onChange={(e) => set("cnpj", e.target.value)}
                  placeholder="00.000.000/0001-00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company_type">Tipo de empresa</Label>
                <Select
                  id="company_type"
                  value={data.company_type}
                  onChange={(e) => set("company_type", e.target.value)}
                >
                  <option value="">Selecione</option>
                  <option value="MEI">MEI</option>
                  <option value="ME">Microempresa</option>
                  <option value="EPP">Empresa de pequeno porte</option>
                  <option value="LTDA">LTDA</option>
                  <option value="SA">S.A.</option>
                  <option value="autonomo">Autônomo</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="segment_label">Segmento (livre)</Label>
                <Input
                  id="segment_label"
                  value={data.segment_label}
                  onChange={(e) => set("segment_label", e.target.value)}
                  placeholder="Confeitaria · padaria artesanal"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="postal_code">CEP</Label>
                <CepInput
                  id="postal_code"
                  value={data.postal_code}
                  onValueChange={(v) => set("postal_code", v)}
                  onResult={(addr) =>
                    setData((d) => ({
                      ...d,
                      address: addr.logradouro || d.address,
                      neighborhood: addr.bairro || d.neighborhood,
                      city: addr.localidade || d.city,
                      state: addr.uf || d.state,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Digite o CEP que a gente preenche o endereço
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Endereço completo</Label>
                <Input
                  id="address"
                  value={data.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Rua tal, número, complemento"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input
                  id="neighborhood"
                  value={data.neighborhood}
                  onChange={(e) => set("neighborhood", e.target.value)}
                  placeholder="Buritis"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={data.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="Belo Horizonte"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="state">UF</Label>
                <Input
                  id="state"
                  maxLength={2}
                  className="uppercase"
                  value={data.state}
                  onChange={(e) => set("state", e.target.value.toUpperCase())}
                  placeholder="MG"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="google_maps_url">Google Maps (link)</Label>
                <Input
                  id="google_maps_url"
                  type="url"
                  value={data.google_maps_url}
                  onChange={(e) => set("google_maps_url", e.target.value)}
                  placeholder="https://maps.google.com/..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="whatsapp_business">WhatsApp comercial</Label>
                <Input
                  id="whatsapp_business"
                  type="tel"
                  value={data.whatsapp_business}
                  onChange={(e) => set("whatsapp_business", e.target.value)}
                  placeholder="(31) 0000-0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  value={data.instagram}
                  onChange={(e) => set("instagram", e.target.value)}
                  placeholder="@paoquente"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={data.website}
                  onChange={(e) => set("website", e.target.value)}
                  placeholder="https://paoquente.com.br"
                />
              </div>
            </div>
          </div>
        )}

        {/* ─── ETAPA 3 — Objetivos ─── */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">O que você quer alcançar?</h2>
              <p className="text-sm text-muted-foreground">
                Marque tudo que se aplica — vamos usar pra sugerir os melhores templates.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {OBJECTIVE_OPTIONS.map((opt) => {
                const active = data.objectives.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleObjective(opt.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all",
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <div
                      className={cn(
                        "grid h-5 w-5 shrink-0 place-items-center rounded border-2",
                        active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30",
                      )}
                    >
                      {active && <Check className="h-3 w-3" />}
                    </div>
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <Badge variant="outline" className="text-xs">
              {data.objectives.length} objetivo{data.objectives.length !== 1 ? "s" : ""} selecionado{data.objectives.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        )}

        {/* ─── ETAPA 4 — Materiais ─── */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Materiais visuais (opcional)</h2>
              <p className="text-sm text-muted-foreground">
                Logo e fotos da sua empresa. Você pode adicionar/alterar depois.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <ImageUpload
                bucket="logos"
                name="logo_url_input"
                label="Logo da empresa"
                defaultUrl={data.logo_url}
                hint="PNG, JPG, WebP ou SVG · até 2MB"
              />
              <ImageUpload
                bucket="banners"
                name="cover_url_input"
                label="Foto principal (capa)"
                aspect="wide"
                defaultUrl={data.cover_url}
                hint="Ideal 16:9 · até 8MB"
              />
            </div>
            {/* Captura os valores dos uploads via hidden + observer */}
            <input
              type="hidden"
              value={data.logo_url}
              ref={(el) => {
                if (!el) return;
                const ext = document.querySelector('input[name="logo_url_input"]') as HTMLInputElement | null;
                if (ext && ext.value !== data.logo_url) set("logo_url", ext.value);
              }}
            />
            <div className="space-y-1.5">
              <Label htmlFor="brand_colors">Cores da marca</Label>
              <Input
                id="brand_colors"
                value={data.brand_colors}
                onChange={(e) => set("brand_colors", e.target.value)}
                placeholder="Ex: amarelo #FFD700 + marrom #5D2E1F"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                rows={3}
                value={data.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Algo importante sobre sua marca, restrições, preferências..."
              />
            </div>

            {/* Hack robusto pra ler logo_url/cover_url dos hidden inputs do ImageUpload */}
            <UploadValueSync
              fields={{
                logo_url_input: (v) => set("logo_url", v),
                cover_url_input: (v) => set("cover_url", v),
              }}
            />
          </div>
        )}

        {/* ─── ETAPA 5 — Termos ─── */}
        {step === 5 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Quase lá!</h2>
              <p className="text-sm text-muted-foreground">
                Leia e aceite os termos da parceria.
              </p>
            </div>

            <Card className="bg-secondary/30">
              <CardContent className="space-y-3 p-4 text-sm">
                <p className="font-semibold">Termos de parceria Xô Varal Local</p>
                <ul className="ml-4 list-disc space-y-1.5 text-muted-foreground">
                  <li>Concedo autorização para uso da minha marca/logo em peças do clube.</li>
                  <li>Banners passam por aprovação interna antes de irem ao ar.</li>
                  <li>Não posso baixar arquivos sem aprovação ou pagamento (quando aplicável).</li>
                  <li>Comprometo-me a honrar os benefícios oferecidos no Clube de Benefícios.</li>
                  <li>Em troca, divulgarei o Clube de Vantagens da Xô Varal para meus clientes.</li>
                  <li>Posso encerrar a parceria a qualquer momento mediante aviso.</li>
                </ul>
              </CardContent>
            </Card>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-primary/5 p-3">
              <input
                type="checkbox"
                checked={data.terms_accepted}
                onChange={(e) => set("terms_accepted", e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span className="text-sm">
                <strong>Aceito os termos</strong> da parceria e autorizo a Xô Varal Local
                a utilizar minha marca conforme descrito acima.
              </span>
            </label>
          </div>
        )}

        {/* Navegação */}
        <div className="flex items-center justify-between gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => (step === 1 ? router.push("/parceiro/dashboard") : setStep(step - 1))}
            disabled={pending}
          >
            <ArrowLeft className="h-4 w-4" />
            {step === 1 ? "Cancelar" : "Voltar"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Etapa {step} de {STEPS.length}
          </span>
          {step < STEPS.length ? (
            <Button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance()}
            >
              Próximo
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={pending || !data.terms_accepted}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Finalizar cadastro
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Sincroniza valores dos ImageUpload (que usam hidden input) para o estado do wizard. */
function UploadValueSync({ fields }: { fields: Record<string, (v: string) => void> }) {
  if (typeof window !== "undefined") {
    setTimeout(() => {
      for (const [name, setter] of Object.entries(fields)) {
        const el = document.querySelector(`input[name="${name}"]`) as HTMLInputElement | null;
        if (el?.value) setter(el.value);
      }
    }, 100);
  }
  return null;
}
