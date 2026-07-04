// Página PÚBLICA (whitelist no proxy) — Portal do cliente Xô Varal.
// Cliente digita o CPF e consulta nível, desconto, ciclos e LavCoins.
import { MeuClubeView } from "./view";

export const metadata = {
  title: "Meu Clube · Xô Varal",
  description: "Consulte seu nível, desconto do mês, ciclos e LavCoins no Clube Xô Varal.",
};

export default function Page() {
  return <MeuClubeView />;
}
