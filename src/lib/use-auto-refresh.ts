"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

/**
 * Hook de auto-refresh que recarrega a página (server) a cada `interval` segundos.
 * Atualiza o contador a cada segundo pra mostrar tempo restante.
 *
 * Retorna controles pra UI: ligado, alternar, força refresh agora, segundos restantes.
 */
export function useAutoRefresh(intervalSec: number = 30, defaultOn: boolean = true) {
  const router = useRouter();
  const [ligado, setLigado] = React.useState(defaultOn);
  const [restante, setRestante] = React.useState(intervalSec);
  const [ultima, setUltima] = React.useState(() => new Date().toISOString());

  React.useEffect(() => {
    if (!ligado) return;
    const interval = setInterval(() => {
      setRestante((r) => {
        if (r <= 1) {
          router.refresh();
          setUltima(new Date().toISOString());
          return intervalSec;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [ligado, intervalSec, router]);

  function refreshAgora() {
    router.refresh();
    setRestante(intervalSec);
    setUltima(new Date().toISOString());
  }

  return { ligado, setLigado, restante, refreshAgora, ultima };
}
