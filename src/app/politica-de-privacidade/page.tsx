import { LegalShell } from "@/components/legal/legal-shell";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata = {
  title: "Política de Privacidade · LavSync",
  description: "Política de Privacidade da LavSync em conformidade com a LGPD (Lei 13.709/2018).",
};

export default function Page() {
  const { empresa, dpo, versoes } = LEGAL_CONFIG;
  return (
    <LegalShell
      title="Política de Privacidade"
      subtitle="Como tratamos seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD)."
      versao={versoes.politicaPrivacidade}
      vigenteDesde={versoes.vigenteDesde}
    >
      <h2>1. Introdução</h2>
      <p>
        A <strong>{empresa.nomeFantasia}</strong>, mantenedora da plataforma SaaS para gestão de
        lavanderias de autosserviço disponível em <a href={empresa.site}>{empresa.site}</a> e
        <a href={empresa.sistema}> {empresa.sistema}</a>, valoriza a privacidade dos titulares
        de dados pessoais e está comprometida com o cumprimento da{" "}
        <strong>Lei nº 13.709/2018 — Lei Geral de Proteção de Dados (LGPD)</strong>.
      </p>
      <p>
        Esta Política descreve como coletamos, usamos, armazenamos, compartilhamos e protegemos
        os dados pessoais que tratamos no exercício de nossas atividades.
      </p>

      <h2>2. Definições</h2>
      <ul>
        <li><strong>Titular:</strong> pessoa natural a quem se referem os dados pessoais.</li>
        <li><strong>Dados pessoais:</strong> informação relacionada a pessoa natural identificada ou identificável (nome, CPF, e-mail, telefone, histórico de compras etc.).</li>
        <li><strong>Tratamento:</strong> toda operação realizada com dados pessoais, como coleta, classificação, utilização, acesso, armazenamento, eliminação etc.</li>
        <li><strong>Controlador:</strong> {empresa.nomeFantasia}, a quem compete as decisões sobre o tratamento.</li>
        <li><strong>Operador:</strong> realiza o tratamento de dados pessoais em nome do controlador.</li>
        <li><strong>Encarregado (DPO):</strong> {dpo.nome}, contato em <a href={`mailto:${dpo.email}`}>{dpo.email}</a>.</li>
      </ul>

      <h2>3. Quais dados coletamos</h2>

      <h3>3.1. Dados de cadastro do operador (cliente LavSync)</h3>
      <ul>
        <li>Nome completo, e-mail, telefone, senha (armazenada de forma criptografada).</li>
        <li>Empresa, cargo, CNPJ da lavanderia.</li>
        <li>Dados de faturamento (em assinatura SaaS): nome, endereço, CNPJ/CPF, meio de pagamento.</li>
      </ul>

      <h3>3.2. Dados dos clientes finais (consumidores da lavanderia)</h3>
      <p>
        Para que o operador (dono de lavanderia) consiga gerir sua operação, processamos dados
        pessoais dos clientes finais capturados pelos sistemas integrados (MAXPAN, VM Tecnologia
        ou inseridos manualmente):
      </p>
      <ul>
        <li>Nome, CPF, e-mail e telefone (quando informados no totem).</li>
        <li>Histórico de compras: data, valor, tipo de serviço, meio de pagamento.</li>
        <li>Cupons e vouchers utilizados.</li>
      </ul>
      <p>
        Nesta hipótese, a <strong>{empresa.nomeFantasia} atua como operadora</strong>, e o
        cliente operador (dono de lavanderia) é o controlador dos dados de seus consumidores.
        Os tratamentos seguem as instruções do controlador e o acordo de tratamento de dados
        firmado entre as partes.
      </p>

      <h3>3.3. Dados de navegação</h3>
      <ul>
        <li>Endereço IP, navegador, sistema operacional.</li>
        <li>Páginas acessadas, data e hora dos acessos.</li>
        <li>Cookies (ver <a href="/politica-de-cookies">Política de Cookies</a>).</li>
      </ul>

      <h2>4. Finalidades do tratamento</h2>
      <ul>
        <li>Permitir o cadastro, autenticação e uso do sistema LavSync.</li>
        <li>Disponibilizar dashboards, relatórios e insights operacionais.</li>
        <li>Processar pagamentos de assinatura e emitir notas fiscais.</li>
        <li>Atender solicitações de suporte e contato.</li>
        <li>Cumprir obrigações legais e regulatórias.</li>
        <li>Prevenir fraude, abuso e violações de segurança.</li>
        <li>Melhorar a qualidade do serviço e desenvolver novas funcionalidades.</li>
        <li>Enviar comunicados operacionais essenciais ao funcionamento da plataforma.</li>
      </ul>

      <h2>5. Bases legais</h2>
      <p>O tratamento dos dados pessoais ocorre com fundamento nas seguintes bases legais (Art. 7º da LGPD):</p>
      <ul>
        <li><strong>Execução de contrato (Art. 7º, V):</strong> para prestação dos serviços contratados.</li>
        <li><strong>Cumprimento de obrigação legal (Art. 7º, II):</strong> emissão de notas fiscais, retenção de dados fiscais e tributários.</li>
        <li><strong>Legítimo interesse (Art. 7º, IX):</strong> para segurança, prevenção de fraude e melhoria do serviço, sempre respeitando direitos e liberdades do titular.</li>
        <li><strong>Consentimento (Art. 7º, I):</strong> para comunicações de marketing, newsletter e cookies não-essenciais.</li>
      </ul>

      <h2>6. Compartilhamento de dados</h2>
      <p>Compartilhamos dados pessoais apenas com:</p>
      <ul>
        <li><strong>Operadores e provedores</strong> que nos auxiliam a prestar o serviço (hospedagem em nuvem Supabase/Vercel, processadores de pagamento, gateways de e-mail e WhatsApp), sob acordo de confidencialidade.</li>
        <li><strong>Autoridades públicas</strong>, quando exigido por lei, ordem judicial ou requisição válida.</li>
        <li><strong>Em caso de operação societária</strong> (fusão, aquisição, reestruturação), os dados podem ser transferidos como parte dos ativos, mantendo-se as obrigações de proteção.</li>
      </ul>
      <p>
        <strong>Não vendemos dados pessoais a terceiros.</strong> Não compartilhamos dados com
        fins publicitários de terceiros.
      </p>

      <h2>7. Transferência internacional</h2>
      <p>
        Parte de nossa infraestrutura (Supabase, Vercel) opera em servidores localizados fora
        do Brasil. As transferências internacionais ocorrem com observância dos requisitos do
        Capítulo V da LGPD, junto a fornecedores que adotam padrões adequados de proteção.
      </p>

      <h2>8. Retenção e eliminação</h2>
      <ul>
        <li>
          Dados de cadastro e uso da plataforma são mantidos enquanto a conta estiver ativa e
          por até <strong>5 anos</strong> após o encerramento, para fins de auditoria,
          obrigações legais e defesa em processos.
        </li>
        <li>
          Dados fiscais são mantidos pelos prazos da legislação tributária aplicável
          (mínimo <strong>5 anos</strong>).
        </li>
        <li>
          Dados de clientes finais (consumidores) são tratados pelos prazos definidos
          pelo operador (dono de lavanderia), respeitada a finalidade.
        </li>
        <li>
          Logs de acesso e segurança são mantidos por <strong>6 meses</strong>, conforme
          Marco Civil da Internet.
        </li>
        <li>
          Após esses prazos, os dados são eliminados ou anonimizados de forma irreversível.
        </li>
      </ul>

      <h2>9. Direitos do titular</h2>
      <p>Você, como titular, pode exercer a qualquer momento os direitos previstos no Art. 18 da LGPD:</p>
      <ul>
        <li>Confirmação da existência de tratamento.</li>
        <li>Acesso aos dados.</li>
        <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
        <li>Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade.</li>
        <li>Portabilidade dos dados a outro fornecedor.</li>
        <li>Eliminação dos dados tratados com base no consentimento.</li>
        <li>Informação sobre entidades públicas e privadas com as quais compartilhamos dados.</li>
        <li>Informação sobre a possibilidade de não fornecer consentimento e suas consequências.</li>
        <li>Revogação do consentimento.</li>
        <li>Oposição ao tratamento.</li>
      </ul>
      <p>
        Para exercer esses direitos, use o formulário em{" "}
        <a href="/direitos-lgpd">/direitos-lgpd</a> ou envie e-mail a{" "}
        <a href={`mailto:${dpo.email}`}>{dpo.email}</a>. Atenderemos no prazo de até{" "}
        <strong>{dpo.prazoResposta}</strong>.
      </p>

      <h2>10. Segurança da informação</h2>
      <p>Adotamos medidas técnicas e administrativas para proteger os dados:</p>
      <ul>
        <li>Criptografia em trânsito (HTTPS/TLS 1.2+) e em repouso.</li>
        <li>Senhas armazenadas com hashing forte.</li>
        <li>Controle de acesso por papel (RBAC) com privilégios mínimos.</li>
        <li>Auditoria de operações sensíveis e logs de acesso.</li>
        <li>Backups regulares e plano de recuperação de desastres.</li>
        <li>Treinamento de equipe e revisão periódica de políticas.</li>
      </ul>
      <p>
        Em caso de <strong>incidente de segurança</strong> que possa acarretar risco ou dano
        relevante aos titulares, comunicaremos a ANPD e os titulares afetados no prazo razoável,
        conforme Art. 48 da LGPD.
      </p>

      <h2>11. Crianças e adolescentes</h2>
      <p>
        Nossos serviços são destinados a pessoas maiores de 18 anos, sendo o cadastro restrito
        a operadores de lavanderias (Pessoa Jurídica ou seus representantes). Não coletamos
        intencionalmente dados de menores de 18 anos.
      </p>

      <h2>12. Alterações desta Política</h2>
      <p>
        Esta Política pode ser atualizada para refletir mudanças legais, operacionais ou
        tecnológicas. Alterações relevantes serão comunicadas com 30 dias de antecedência por
        e-mail e/ou destacadas na plataforma. O uso contínuo após a vigência indica concordância
        com a nova versão.
      </p>

      <h2>13. Contato e DPO</h2>
      <p>
        Para dúvidas ou exercício de direitos, contate nosso Encarregado de Proteção de Dados:
      </p>
      <ul>
        <li><strong>{dpo.nome}</strong></li>
        <li>E-mail: <a href={`mailto:${dpo.email}`}>{dpo.email}</a></li>
        <li>Atendimento: {dpo.horario}</li>
      </ul>
      <p>
        Você também pode acionar a <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong>{" "}
        em <a href="https://www.gov.br/anpd" target="_blank" rel="noreferrer">www.gov.br/anpd</a>.
      </p>
    </LegalShell>
  );
}
