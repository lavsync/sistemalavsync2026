import { LegalShell } from "@/components/legal/legal-shell";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata = {
  title: "Termos de Uso · LavSync",
  description: "Termos e condições de uso da plataforma LavSync.",
};

export default function Page() {
  const { empresa, dpo, versoes } = LEGAL_CONFIG;
  return (
    <LegalShell
      title="Termos de Uso"
      subtitle="Condições gerais para uso do site e da plataforma LavSync."
      versao={versoes.termosUso}
      vigenteDesde={versoes.vigenteDesde}
    >
      <h2>1. Aceitação</h2>
      <p>
        Estes Termos de Uso (&ldquo;Termos&rdquo;) regulam o acesso e o uso do site{" "}
        <a href={empresa.site}>{empresa.site}</a> e da plataforma{" "}
        <a href={empresa.sistema}>{empresa.sistema}</a> (em conjunto, &ldquo;Plataforma&rdquo;),
        mantida por <strong>{empresa.nomeFantasia}</strong> ({empresa.razaoSocial}, {empresa.cnpj}).
      </p>
      <p>
        Ao se cadastrar, acessar ou utilizar qualquer funcionalidade da Plataforma, você
        declara ter lido, compreendido e aceito integralmente estes Termos e nossa{" "}
        <a href="/politica-de-privacidade">Política de Privacidade</a>. Caso não concorde,
        deve interromper imediatamente o uso.
      </p>

      <h2>2. Objeto e descrição do serviço</h2>
      <p>
        A LavSync é uma plataforma SaaS de gestão inteligente para lavanderias de autosserviço
        e redes de franquias, oferecendo dashboards, importação de relatórios, indicadores
        operacionais, gestão de clientes e ferramentas de inteligência artificial.
      </p>
      <p>
        O uso da Plataforma está condicionado a cadastro válido e ao cumprimento destes Termos.
      </p>

      <h2>3. Cadastro e conta</h2>
      <ul>
        <li>O cadastro é destinado a pessoas maiores de 18 anos, com capacidade civil plena, agindo em nome próprio ou de pessoa jurídica regularmente constituída.</li>
        <li>O usuário compromete-se a fornecer informações verdadeiras, atualizadas e completas, e a mantê-las atualizadas.</li>
        <li>O usuário é responsável pela guarda e sigilo de suas credenciais. Atividades realizadas com sua conta presumem-se realizadas por ele.</li>
        <li>Em caso de uso indevido ou suspeita de comprometimento, comunique imediatamente em <a href={`mailto:${empresa.email}`}>{empresa.email}</a>.</li>
      </ul>

      <h2>4. Planos, assinatura e pagamento</h2>
      <ul>
        <li>O uso da Plataforma pode ser <strong>gratuito</strong> (modo demonstração/freemium) ou <strong>pago</strong> mediante assinatura mensal/anual conforme plano contratado.</li>
        <li>Os preços, condições e funcionalidades de cada plano são informados na Plataforma e podem ser alterados mediante aviso prévio de 30 dias.</li>
        <li>O pagamento é processado por gateways terceiros (cartão de crédito, PIX, boleto). A LavSync não armazena dados completos de cartão.</li>
        <li>Em caso de inadimplemento, o acesso poderá ser suspenso após notificação. Permanecendo a inadimplência por mais de 30 dias, a conta poderá ser cancelada e os dados poderão ser excluídos após período de retenção legal.</li>
      </ul>

      <h2>5. Arrependimento e reembolso</h2>
      <p>
        Em contratações realizadas pela internet, o cliente pessoa física consumidora pode
        exercer o direito de arrependimento no prazo de <strong>7 (sete) dias corridos</strong>{" "}
        contados da contratação, conforme Art. 49 do CDC, com reembolso integral, exceto pelo
        uso já realizado. Para exercê-lo, envie e-mail a{" "}
        <a href={`mailto:${empresa.email}`}>{empresa.email}</a> dentro do prazo.
      </p>

      <h2>6. Uso adequado</h2>
      <p>É vedado ao usuário:</p>
      <ul>
        <li>Acessar ou tentar acessar contas, sistemas ou dados que não lhe pertencem.</li>
        <li>Realizar engenharia reversa, descompilar ou tentar extrair o código-fonte.</li>
        <li>Sobrecarregar, prejudicar ou interferir no funcionamento da Plataforma.</li>
        <li>Utilizar a Plataforma para atividades ilícitas, fraude, lavagem de dinheiro, sonegação ou prática contrária à legislação.</li>
        <li>Carregar conteúdo difamatório, discriminatório, com vírus ou que infrinja direitos de terceiros.</li>
        <li>Reproduzir, distribuir ou comercializar conteúdo, marca, código ou design da Plataforma sem autorização escrita.</li>
      </ul>
      <p>
        O descumprimento autoriza a LavSync a <strong>suspender ou cancelar imediatamente</strong>{" "}
        a conta, sem prejuízo das medidas legais cabíveis.
      </p>

      <h2>7. Propriedade intelectual</h2>
      <p>
        A marca &ldquo;LavSync&rdquo;, o logotipo, o sistema, sua interface, layout, código,
        documentação e conteúdo editorial são de propriedade exclusiva da{" "}
        <strong>{empresa.nomeFantasia}</strong>, protegidos pela legislação de direitos
        autorais, propriedade industrial e correlatas.
      </p>
      <p>
        Concedemos ao usuário licença <strong>não exclusiva, intransferível, revogável</strong>{" "}
        e limitada para uso da Plataforma enquanto vigente sua contratação e cumpridos estes
        Termos. Nenhuma transferência de titularidade ocorre.
      </p>

      <h2>8. Dados do usuário e privacidade</h2>
      <p>
        O tratamento de dados pessoais segue nossa <a href="/politica-de-privacidade">Política
        de Privacidade</a> em conformidade com a LGPD. Quando o usuário (cliente LavSync)
        carrega na Plataforma dados pessoais de seus próprios clientes finais (consumidores
        de sua lavanderia), atua como <strong>controlador</strong> desses dados, e a LavSync
        atua como <strong>operadora</strong>.
      </p>

      <h2>9. Disponibilidade e manutenção</h2>
      <ul>
        <li>Empenhamo-nos para manter a Plataforma disponível, com SLA de uptime informado em cada plano.</li>
        <li>Poderemos realizar manutenções programadas, comunicadas com antecedência sempre que possível.</li>
        <li>Não nos responsabilizamos por indisponibilidade causada por terceiros (provedores de internet, energia, datacenters), caso fortuito ou força maior.</li>
      </ul>

      <h2>10. Limitação de responsabilidade</h2>
      <p>
        A Plataforma é fornecida &ldquo;<strong>como está</strong>&rdquo;. Embora adotemos as
        melhores práticas, não garantimos que será ininterrupta, livre de erros ou de
        vulnerabilidades. Indicadores, previsões e sugestões automatizadas têm caráter{" "}
        <strong>informativo e auxiliar</strong>, não substituindo o julgamento profissional do
        operador.
      </p>
      <p>
        Na máxima extensão permitida em lei, a responsabilidade da LavSync por danos diretos
        está limitada ao valor efetivamente pago pelo usuário nos 12 meses anteriores ao
        evento. Não nos responsabilizamos por lucros cessantes, danos indiretos ou consequenciais.
      </p>
      <p>
        Nada nesta cláusula limita responsabilidades indeclináveis pelo CDC ou pela legislação aplicável.
      </p>

      <h2>11. Rescisão</h2>
      <ul>
        <li>O usuário pode cancelar a conta a qualquer momento pelo painel ou contatando o suporte.</li>
        <li>A LavSync pode rescindir o contrato em caso de descumprimento destes Termos ou da legislação aplicável, com notificação prévia quando possível.</li>
        <li>O cancelamento não exime obrigações financeiras vencidas.</li>
        <li>Após o cancelamento, os dados serão tratados conforme nossa Política de Privacidade.</li>
      </ul>

      <h2>12. Alterações</h2>
      <p>
        Estes Termos podem ser alterados a qualquer momento. Mudanças substanciais serão
        comunicadas por e-mail e na Plataforma com 30 dias de antecedência. O uso continuado
        após a vigência indica concordância. Caso discorde, você pode cancelar a conta sem
        ônus dentro desse período.
      </p>

      <h2>13. Comunicações</h2>
      <p>
        Aceito o envio de comunicações operacionais essenciais à prestação do serviço por
        e-mail e/ou notificação na Plataforma. Comunicações de marketing dependem de
        consentimento específico, que pode ser revogado a qualquer momento.
      </p>

      <h2>14. Lei aplicável e foro</h2>
      <p>
        Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito
        o foro do <strong>domicílio do consumidor</strong> nas relações de consumo, ou,
        nas demais relações, o foro da Comarca de <strong>Belo Horizonte/MG</strong>, com
        renúncia a qualquer outro, por mais privilegiado que seja.
      </p>

      <h2>15. Contato</h2>
      <p>
        Dúvidas sobre estes Termos? Fale com a gente em{" "}
        <a href={`mailto:${empresa.email}`}>{empresa.email}</a>. Para temas de privacidade,
        contate o DPO em <a href={`mailto:${dpo.email}`}>{dpo.email}</a>.
      </p>
    </LegalShell>
  );
}
