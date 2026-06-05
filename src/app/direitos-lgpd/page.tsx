import { LegalShell } from "@/components/legal/legal-shell";
import { DireitosLgpdForm } from "@/components/legal/direitos-lgpd-form";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata = {
  title: "Direitos do Titular (LGPD) · LavSync",
  description: "Exerça seus direitos como titular de dados pessoais conforme a LGPD.",
};

export default function Page() {
  const { dpo } = LEGAL_CONFIG;
  return (
    <LegalShell
      title="Exerça seus direitos LGPD"
      subtitle="Como titular de dados, você tem direitos garantidos pela Lei 13.709/2018. Use este formulário pra exercê-los — atendemos em até 15 dias."
    >
      <h2>Seus direitos (Art. 18 LGPD)</h2>
      <ul>
        <li><strong>Confirmação e acesso</strong> — saber se tratamos seus dados e ter cópia deles.</li>
        <li><strong>Correção</strong> — atualizar dados incompletos ou incorretos.</li>
        <li><strong>Anonimização ou eliminação</strong> — apagar dados desnecessários ou tratados em desacordo com a lei.</li>
        <li><strong>Portabilidade</strong> — receber seus dados em formato estruturado pra levar a outro fornecedor.</li>
        <li><strong>Revogação de consentimento</strong> — retirar autorização para tratamentos baseados em consentimento.</li>
        <li><strong>Oposição</strong> — opor-se a tratamento sem base legal adequada.</li>
        <li><strong>Informação</strong> — saber com quem compartilhamos seus dados.</li>
      </ul>

      <p>
        Para garantir sua identidade, podemos solicitar documentos adicionais. O atendimento
        ocorre em até <strong>15 dias corridos</strong> (Art. 19 LGPD). Em caso de necessidade
        de prazo adicional, comunicaremos com a justificativa.
      </p>

      <h2>Formulário de solicitação</h2>
      <DireitosLgpdForm />

      <h2>Outras formas de contato</h2>
      <p>
        Você também pode enviar diretamente para nosso Encarregado de Dados:
      </p>
      <ul>
        <li>E-mail: <a href={`mailto:${dpo.email}`}>{dpo.email}</a></li>
        <li>Atendimento: {dpo.horario}</li>
      </ul>

      <h2>Reclamação à ANPD</h2>
      <p>
        Caso não esteja satisfeito com o atendimento, você pode acionar a{" "}
        <strong>Autoridade Nacional de Proteção de Dados</strong> em{" "}
        <a href="https://www.gov.br/anpd" target="_blank" rel="noreferrer">www.gov.br/anpd</a>.
      </p>
    </LegalShell>
  );
}
