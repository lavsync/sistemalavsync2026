// LavSync · catálogo de integrações que o usuário pode conectar
// Cada provider declara: env vars necessárias, link de obtenção, teste de conexão.

import {
  Database, Cloud, GitBranch, MessageCircle, Calendar, BarChart3, Megaphone,
  CreditCard, type LucideIcon,
} from "lucide-react";

export type IntegrationCategory = "infra" | "comunicacao" | "produtividade" | "bi" | "marketing" | "financeiro";

export type CredentialField = {
  /** chave do .env.local */
  envKey: string;
  /** rótulo no formulário */
  label: string;
  /** explicação curta */
  hint?: string;
  /** placeholder do input */
  placeholder?: string;
  /** secret = renderiza como password e mascara no GET status */
  secret?: boolean;
  /** se true, valor pré-preenchido pelo sistema (ex: project ref derivado do URL) */
  derived?: boolean;
};

export type IntegrationStep = {
  /** título curto do passo */
  title: string;
  /** texto longo (markdown-like simples) */
  body: string;
  /** link externo direto pra ação */
  href?: string;
  /** texto do botão do link */
  hrefLabel?: string;
};

export type ProviderId =
  | "supabase"
  | "vercel"
  | "github"
  | "zapi"
  | "twilio"
  | "meta_whatsapp"
  | "google_calendar"
  | "powerbi"
  | "meta_ads"
  | "stone";

export type IntegrationProvider = {
  id: ProviderId;
  name: string;
  vendor: string;
  category: IntegrationCategory;
  description: string;
  icon: LucideIcon;
  color: string;
  /** se true, integração já vem nativa (não precisa configurar) */
  builtin?: boolean;
  /** documentação curta */
  docsUrl?: string;
  /** campos a salvar */
  fields: CredentialField[];
  /** wizard passo a passo */
  steps?: IntegrationStep[];
  /** se a integração é necessária para um módulo do produto */
  requiredFor?: string[];
};

export const PROVIDERS: IntegrationProvider[] = [
  {
    id: "supabase",
    name: "Supabase",
    vendor: "Supabase Inc.",
    category: "infra",
    description: "Banco PostgreSQL + Auth + Storage. Núcleo do LavSync.",
    icon: Database,
    color: "#3ecf8e",
    docsUrl: "https://supabase.com/docs",
    fields: [
      { envKey: "NEXT_PUBLIC_SUPABASE_URL", label: "Project URL", placeholder: "https://xxxx.supabase.co" },
      { envKey: "NEXT_PUBLIC_SUPABASE_ANON_KEY", label: "Anon Key", secret: true, placeholder: "eyJhbGciOi..." },
      { envKey: "SUPABASE_SERVICE_ROLE_KEY", label: "Service Role Key", secret: true, placeholder: "eyJhbGciOi..." },
      { envKey: "SUPABASE_ACCESS_TOKEN", label: "Personal Access Token (Management API)", secret: true, placeholder: "sbp_..." },
    ],
    steps: [
      { title: "Crie/abra seu projeto", body: "Login no Supabase e selecione (ou crie) o projeto LavSync.", href: "https://supabase.com/dashboard/projects", hrefLabel: "Abrir projetos" },
      { title: "Project URL + Anon + Service Role", body: "Project Settings → API → copie URL, anon key e service_role.", href: "https://supabase.com/dashboard/project/_/settings/api", hrefLabel: "Settings → API" },
      { title: "Personal Access Token", body: "Sua conta (avatar) → Account → Access Tokens → 'Generate new token' → escopo full. Necessário para que o LavSync aplique migrations sozinho.", href: "https://supabase.com/dashboard/account/tokens", hrefLabel: "Gerar token" },
    ],
  },
  {
    id: "vercel",
    name: "Vercel",
    vendor: "Vercel Inc.",
    category: "infra",
    description: "Deploy + domínios + edge runtime. Você já está rodando aqui.",
    icon: Cloud,
    color: "#000000",
    docsUrl: "https://vercel.com/docs",
    fields: [
      { envKey: "VERCEL_TOKEN", label: "Vercel Personal Token", secret: true, placeholder: "vercel_..." },
    ],
    steps: [
      { title: "Gere o token", body: "Vercel → Account Settings → Tokens → Create. Escopo: Full Account.", href: "https://vercel.com/account/tokens", hrefLabel: "Criar token" },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    vendor: "GitHub",
    category: "infra",
    description: "Versionamento + CI. Útil pra deploys automáticos via push.",
    icon: GitBranch,
    color: "#181717",
    fields: [
      { envKey: "GITHUB_TOKEN", label: "Personal Access Token", secret: true, placeholder: "ghp_..." },
      { envKey: "GITHUB_REPO", label: "Repositório (owner/repo)", placeholder: "danielqueiroz137/lavsync" },
    ],
    steps: [
      { title: "Gere o token", body: "Settings → Developer settings → Personal access tokens (classic) → Generate. Marque escopos repo + workflow.", href: "https://github.com/settings/tokens/new?scopes=repo,workflow&description=LavSync", hrefLabel: "Criar token" },
    ],
  },
  {
    id: "zapi",
    name: "Z-API · WhatsApp",
    vendor: "Z-API",
    category: "comunicacao",
    description: "Provider BR mais simples. R$99/mês ilimitado. Conecta via QR-code.",
    icon: MessageCircle,
    color: "#25D366",
    docsUrl: "https://developer.z-api.io/",
    requiredFor: ["agenda · alertas WhatsApp"],
    fields: [
      { envKey: "ZAPI_INSTANCE_ID", label: "Instance ID", placeholder: "3D8BC5..." },
      { envKey: "ZAPI_TOKEN", label: "Instance Token", secret: true, placeholder: "9F2A1B..." },
      { envKey: "ZAPI_CLIENT_TOKEN", label: "Client Security Token (recomendado)", secret: true, placeholder: "F1234567A..." },
    ],
    steps: [
      { title: "Crie sua instância", body: "Login no Z-API → 'Criar instância' → escaneie o QR no WhatsApp Business do seu celular.", href: "https://app.z-api.io/login", hrefLabel: "Abrir Z-API" },
      { title: "Pegue Instance ID + Token", body: "Menu lateral → 'Tokens' → copie Instance ID e Token.", href: "https://app.z-api.io/instances", hrefLabel: "Ver tokens" },
      { title: "Client Token (segurança)", body: "Menu Conta → Security Token → ative e copie. Bloqueia chamadas não-autenticadas.", href: "https://app.z-api.io/account/security-token", hrefLabel: "Ativar" },
    ],
  },
  {
    id: "twilio",
    name: "Twilio · WhatsApp",
    vendor: "Twilio Inc.",
    category: "comunicacao",
    description: "Provider global. Pay-per-message (~US$0,005). Sandbox grátis.",
    icon: MessageCircle,
    color: "#F22F46",
    docsUrl: "https://www.twilio.com/docs/whatsapp",
    requiredFor: ["agenda · alertas WhatsApp"],
    fields: [
      { envKey: "TWILIO_ACCOUNT_SID", label: "Account SID", placeholder: "AC..." },
      { envKey: "TWILIO_AUTH_TOKEN", label: "Auth Token", secret: true, placeholder: "..." },
      { envKey: "TWILIO_WHATSAPP_FROM", label: "WhatsApp From (E.164)", placeholder: "+14155238886" },
    ],
    steps: [
      { title: "Crie/acesse sua conta", body: "Login Twilio Console.", href: "https://console.twilio.com/", hrefLabel: "Abrir console" },
      { title: "Account SID + Auth Token", body: "Home do console → topo direito mostra Account SID. Clique em 'View' para o Auth Token.", href: "https://console.twilio.com/", hrefLabel: "Pegar credenciais" },
      { title: "Sandbox WhatsApp (grátis)", body: "Messaging → Try it out → Send a WhatsApp message → siga 2 passos pra ativar o sandbox + pegue o número 'From'.", href: "https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn", hrefLabel: "Sandbox WhatsApp" },
    ],
  },
  {
    id: "meta_whatsapp",
    name: "Meta Cloud API · WhatsApp",
    vendor: "Meta",
    category: "comunicacao",
    description: "Oficial. Grátis até 1k conversas/mês. Setup mais demorado (verificação).",
    icon: MessageCircle,
    color: "#0084FF",
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
    requiredFor: ["agenda · alertas WhatsApp"],
    fields: [
      { envKey: "META_WA_PHONE_ID", label: "Phone Number ID", placeholder: "123456789..." },
      { envKey: "META_WA_TOKEN", label: "Permanent Access Token", secret: true, placeholder: "EAAB..." },
      { envKey: "META_WA_BUSINESS_ID", label: "WhatsApp Business Account ID", placeholder: "987654321..." },
    ],
    steps: [
      { title: "Meta for Developers", body: "Crie um app tipo Business → adicione produto WhatsApp.", href: "https://developers.facebook.com/apps/", hrefLabel: "Criar app" },
      { title: "Phone Number ID + token temp", body: "WhatsApp → Getting Started → copie Phone Number ID e o token de 24h pra testar.", href: "https://developers.facebook.com/apps/", hrefLabel: "Getting Started" },
      { title: "Token permanente", body: "Business Settings → Users → System Users → crie 'lavsync-bot' → atribua permissões WhatsApp → Generate Token (escopo: whatsapp_business_messaging).", href: "https://business.facebook.com/settings/system-users", hrefLabel: "System Users" },
    ],
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    vendor: "Google",
    category: "produtividade",
    description: "Sincroniza eventos da agenda 2-way (cria/atualiza/exclui).",
    icon: Calendar,
    color: "#4285F4",
    docsUrl: "https://developers.google.com/calendar/api/guides/overview",
    requiredFor: ["agenda · sync Google"],
    fields: [
      { envKey: "GOOGLE_CLIENT_ID", label: "OAuth Client ID", placeholder: "xxxx-xxxx.apps.googleusercontent.com" },
      { envKey: "GOOGLE_CLIENT_SECRET", label: "OAuth Client Secret", secret: true, placeholder: "GOCSPX-..." },
    ],
    steps: [
      { title: "Crie projeto no Google Cloud", body: "Nome sugerido: 'LavSync'.", href: "https://console.cloud.google.com/projectcreate", hrefLabel: "Criar projeto" },
      { title: "Habilite a Calendar API", body: "Procure 'Google Calendar API' e clique Enable.", href: "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com", hrefLabel: "Enable API" },
      { title: "Tela de consentimento OAuth", body: "External · App name 'LavSync' · adicione scope .../auth/calendar.events · adicione seu e-mail em Test users.", href: "https://console.cloud.google.com/apis/credentials/consent", hrefLabel: "Consent screen" },
      { title: "OAuth Client ID", body: "Credentials → Create Credentials → OAuth client ID → Web app · Authorized redirect URIs: http://localhost:3000/api/google/callback E https://sistema.lavsync.com.br/api/google/callback", href: "https://console.cloud.google.com/apis/credentials", hrefLabel: "Criar credentials" },
    ],
  },
  {
    id: "powerbi",
    name: "Power BI",
    vendor: "Microsoft",
    category: "bi",
    description: "Export OData semanal pra dashboards externos. Roadmap.",
    icon: BarChart3,
    color: "#F2C811",
    fields: [
      { envKey: "POWERBI_WORKSPACE_ID", label: "Workspace ID", placeholder: "uuid" },
      { envKey: "POWERBI_DATASET_ID", label: "Dataset ID", placeholder: "uuid" },
    ],
  },
  {
    id: "meta_ads",
    name: "Meta Ads",
    vendor: "Meta",
    category: "marketing",
    description: "Pixel + sync de conversões offline pra otimizar campanhas.",
    icon: Megaphone,
    color: "#1877F2",
    fields: [
      { envKey: "META_PIXEL_ID", label: "Pixel ID", placeholder: "123456789..." },
      { envKey: "META_CAPI_TOKEN", label: "Conversions API Token", secret: true, placeholder: "EAAB..." },
    ],
  },
  {
    id: "stone",
    name: "Stone",
    vendor: "Stone Pagamentos",
    category: "financeiro",
    description: "Conciliação automática D+1 das vendas via Stone.",
    icon: CreditCard,
    color: "#00A868",
    fields: [
      { envKey: "STONE_CLIENT_ID", label: "Client ID", placeholder: "..." },
      { envKey: "STONE_CLIENT_SECRET", label: "Client Secret", secret: true, placeholder: "..." },
    ],
  },
];

export const CATEGORY_META: Record<IntegrationCategory, { label: string; tone: string }> = {
  infra: { label: "Infraestrutura", tone: "text-brand-cyan bg-brand-cyan/10" },
  comunicacao: { label: "Comunicação", tone: "text-success bg-success/10" },
  produtividade: { label: "Produtividade", tone: "text-brand-purple bg-brand-purple/10" },
  bi: { label: "BI / Analytics", tone: "text-warning bg-warning/10" },
  marketing: { label: "Marketing", tone: "text-brand-blue bg-brand-blue/10" },
  financeiro: { label: "Financeiro", tone: "text-success bg-success/10" },
};

export function getProvider(id: ProviderId): IntegrationProvider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
