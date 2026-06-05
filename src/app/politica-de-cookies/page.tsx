import { LegalShell } from "@/components/legal/legal-shell";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata = {
  title: "Política de Cookies · LavSync",
  description: "Como a LavSync utiliza cookies e tecnologias similares.",
};

export default function Page() {
  const { dpo, versoes } = LEGAL_CONFIG;
  return (
    <LegalShell
      title="Política de Cookies"
      subtitle="O que são, como usamos e como você pode controlar os cookies na LavSync."
      versao={versoes.politicaCookies}
      vigenteDesde={versoes.vigenteDesde}
    >
      <h2>1. O que são cookies?</h2>
      <p>
        Cookies são pequenos arquivos de texto armazenados no seu dispositivo quando você
        acessa um site. Eles permitem que o site &ldquo;lembre&rdquo; suas ações e preferências
        (login, idioma, tamanho de fonte) durante um período.
      </p>
      <p>
        Também utilizamos tecnologias similares (localStorage, sessionStorage e
        pixels/web beacons) com finalidades equivalentes.
      </p>

      <h2>2. Tipos de cookies que usamos</h2>

      <h3>2.1. Essenciais (sempre ativos)</h3>
      <p>São indispensáveis para o funcionamento da Plataforma. Sem eles, recursos básicos
      como login, segurança e preferências não funcionam. Não dependem de consentimento.</p>
      <ul>
        <li><strong>Sessão de autenticação Supabase</strong> — mantém você logado.</li>
        <li><strong>Preferência de unidade ativa</strong> — lembra qual unidade você está vendo.</li>
        <li><strong>Tema (claro/escuro)</strong> e estado do menu lateral.</li>
        <li><strong>Proteção CSRF e segurança</strong>.</li>
      </ul>

      <h3>2.2. Analíticos (com consentimento)</h3>
      <p>Coletam estatísticas agregadas sobre o uso da Plataforma para nos ajudar a melhorar
      funcionalidades, performance e UX. Dados são, sempre que possível, anonimizados.</p>
      <ul>
        <li>Páginas mais visitadas, fluxos de navegação, tempo em cada tela.</li>
        <li>Tipo de dispositivo, navegador e sistema operacional.</li>
        <li>Erros e falhas para diagnóstico técnico.</li>
      </ul>

      <h3>2.3. Funcionais (com consentimento)</h3>
      <p>Lembram preferências para personalizar sua experiência.</p>
      <ul>
        <li>Filtros e configurações salvas em dashboards.</li>
        <li>Estado da barra do IA Copilot (recolhida/expandida).</li>
      </ul>

      <h3>2.4. Marketing (com consentimento)</h3>
      <p>Atualmente não utilizamos cookies de marketing de terceiros na plataforma.
      Se vierem a ser implementados, este texto será atualizado e novo consentimento será solicitado.</p>

      <h2>3. Como controlar cookies</h2>
      <p>Você pode controlar cookies de três formas:</p>
      <ol>
        <li><strong>Banner de consentimento</strong> exibido no primeiro acesso à Plataforma, onde você aceita ou recusa categorias não-essenciais.</li>
        <li><strong>Preferências do navegador</strong> (Chrome, Firefox, Safari, Edge), permitindo bloquear ou apagar cookies por site.</li>
        <li><strong>Página de configurações</strong> dentro do sistema, em &ldquo;Configurações → Privacidade&rdquo;, para revisar e revogar consentimentos.</li>
      </ol>
      <p>
        <strong>Atenção:</strong> bloquear cookies essenciais pode impedir o uso da Plataforma.
      </p>

      <h2>4. Cookies de terceiros</h2>
      <p>
        Recursos hospedados por nossos provedores podem definir cookies próprios:
      </p>
      <ul>
        <li><strong>Vercel</strong> (hospedagem) — cookies para roteamento de borda e performance.</li>
        <li><strong>Supabase</strong> (banco e autenticação) — cookies de sessão.</li>
        <li><strong>Provedores de pagamento</strong> (Stone, Pagar.me, gateway de PIX) — cookies para processamento de transações no checkout.</li>
      </ul>
      <p>
        Esses cookies seguem as políticas de cada fornecedor. Recomendamos consultar as
        respectivas políticas para mais informações.
      </p>

      <h2>5. Retenção</h2>
      <ul>
        <li><strong>Cookies de sessão:</strong> excluídos quando você fecha o navegador.</li>
        <li><strong>Cookies persistentes:</strong> permanecem por um prazo definido (em geral, até 12 meses) ou até que você os apague.</li>
      </ul>

      <h2>6. Alterações nesta Política</h2>
      <p>
        Esta Política pode ser atualizada periodicamente. A data de vigência será sempre
        atualizada no topo do documento. Alterações relevantes serão comunicadas dentro do sistema.
      </p>

      <h2>7. Contato</h2>
      <p>
        Dúvidas sobre cookies? Contate nosso DPO em{" "}
        <a href={`mailto:${dpo.email}`}>{dpo.email}</a>.
      </p>
    </LegalShell>
  );
}
