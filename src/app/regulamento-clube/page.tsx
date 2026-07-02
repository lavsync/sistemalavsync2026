// Página PÚBLICA (whitelist no proxy) — Regulamento do programa de
// fidelidade Xô Varal (Clube + LavCoin). Referenciada nas mensagens,
// QR das lojas e materiais de marketing.
export const dynamic = "force-static";

export const metadata = {
  title: "Regulamento · Clube Xô Varal & LavCoin",
  description: "Regulamento oficial do programa de fidelidade Xô Varal: níveis de desconto, LavCoins e condições de uso.",
};

const NIVEIS = [
  { nome: "Bronze", ciclos: "8 a 11 ciclos/mês", desconto: "5% no mês seguinte" },
  { nome: "Prata", ciclos: "12 a 19 ciclos/mês", desconto: "10% no mês seguinte" },
  { nome: "Ouro", ciclos: "20 a 29 ciclos/mês", desconto: "15% no mês seguinte" },
  { nome: "Diamante", ciclos: "30+ ciclos/mês", desconto: "20% no mês seguinte" },
];

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-slate-800">
      <h1 className="text-3xl font-bold tracking-tight">Regulamento — Clube Xô Varal &amp; LavCoin</h1>
      <p className="mt-2 text-sm text-slate-500">
        Programa de fidelidade das lavanderias Xô Varal. Ao informar seu CPF nas máquinas, você adere a este regulamento.
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">1. Como funciona</h2>
        <p>
          O programa tem dois benefícios que funcionam juntos:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>LavCoins</strong> — a cada R$ 1,00 gasto em lavagem ou secagem, você acumula 1 LavCoin.
            LavCoins podem ser trocados por brindes e recompensas do clube.
          </li>
          <li>
            <strong>Níveis de desconto</strong> — cada ciclo de lavagem e cada ciclo de secagem realizados dentro do mês
            contam para a sua classificação. O nível alcançado dá <strong>desconto em todos os ciclos durante o mês
            seguinte inteiro</strong>.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">2. Níveis e descontos</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border rounded-lg">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="px-3 py-2">Nível</th>
                <th className="px-3 py-2">Ciclos no mês (lavagem + secagem)</th>
                <th className="px-3 py-2">Benefício</th>
              </tr>
            </thead>
            <tbody>
              {NIVEIS.map((n) => (
                <tr key={n.nome} className="border-t">
                  <td className="px-3 py-2 font-medium">{n.nome}</td>
                  <td className="px-3 py-2">{n.ciclos}</td>
                  <td className="px-3 py-2">{n.desconto}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          A apuração é fechada ao fim de cada mês. No dia 1º do mês seguinte você recebe uma mensagem com o nível
          alcançado e o desconto válido para aquele mês. Durante o mês, você pode consultar quantos ciclos já
          acumulou e quantos faltam para o próximo nível.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">3. CPF pessoal e intransferível</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-2">
          <p>
            <strong>O CPF cadastrado é pessoal e intransferível.</strong> Somente o titular do CPF digitado pode
            utilizar as máquinas da unidade com esse cadastro.
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Não é permitida a utilização do CPF por outra pessoa que não o próprio titular, para acumular
              LavCoins ou ciclos de classificação. <strong>Confirmado o uso por terceiros por meio das câmeras de
              segurança da unidade, os pontos e ciclos correspondentes não serão acumulados.</strong>
            </li>
            <li>
              Não é permitido que outra pessoa utilize o CPF de cadastro do titular para lavar ou secar com o
              desconto do nível na unidade.
            </li>
            <li>
              O descumprimento reiterado destas condições poderá acarretar a suspensão ou o cancelamento da
              participação no programa, sem prejuízo dos ciclos já pagos.
            </li>
          </ul>
        </div>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">4. Condições gerais</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Participam da apuração apenas ciclos pagos e concluídos com sucesso, vinculados ao CPF no momento do uso.</li>
          <li>Ciclos e LavCoins não têm valor em dinheiro, não são conversíveis em espécie e não são transferíveis entre CPFs.</li>
          <li>O desconto do nível vale para todos os ciclos de lavagem e secagem do mês de aplicação, em qualquer unidade Xô Varal participante.</li>
          <li>Em caso de estorno ou cancelamento de pagamento, os LavCoins e ciclos correspondentes são revertidos.</li>
          <li>A Xô Varal pode ajustar faixas, percentuais e benefícios do programa, comunicando previamente pelos canais oficiais. Benefícios já concedidos são preservados até o fim do mês de aplicação.</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">5. Comunicações e privacidade</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            Ao participar, você concorda em receber comunicações sobre o programa (nível, LavCoins, benefícios)
            pelos canais informados no cadastro, em especial WhatsApp.
          </li>
          <li>
            Para deixar de receber mensagens promocionais, basta responder <strong>SAIR</strong> a qualquer mensagem.
            Comunicações operacionais essenciais podem continuar sendo enviadas.
          </li>
          <li>
            O tratamento dos seus dados segue a nossa{" "}
            <a href="/politica-de-privacidade" className="underline">Política de Privacidade</a> e a LGPD.
            Você pode exercer seus direitos em <a href="/direitos-lgpd" className="underline">Direitos LGPD</a>.
          </li>
          <li>
            As imagens das câmeras de segurança das unidades são utilizadas exclusivamente para segurança e para a
            verificação de conformidade descrita na seção 3, nos limites da legislação vigente.
          </li>
        </ul>
      </section>

      <p className="mt-10 text-xs text-slate-400">
        Xô Varal Lavanderias · Regulamento vigente a partir de julho/2026 · Dúvidas nos canais oficiais das unidades.
      </p>
    </main>
  );
}
