import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listarUnidades, getUnidadeAtiva } from "@/lib/unidade-ativa";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { ClockRail } from "./clock-rail";
import { SignOutButton } from "./signout-button";
import type { SessionUser } from "./types";

export async function AppShell({
  children,
  hideClockRail = false,
}: {
  children: React.ReactNode;
  hideClockRail?: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defesa em profundidade: o proxy já redireciona, mas garantimos aqui também.
  if (!user) redirect("/login");

  const sessionUser = toSessionUser(user);
  const [unidades, unidadeAtiva] = await Promise.all([
    listarUnidades(),
    getUnidadeAtiva(),
  ]);

  return (
    <div className="min-h-screen flex items-start bg-mesh-dark">
      {/* Sidebar — desktop ocupa espaço, mobile vira drawer via mobile-nav */}
      <Sidebar user={sessionUser} signOutSlot={<SignOutButton />} />

      {/* Coluna principal — min-w-0 essencial pra Recharts ResponsiveContainer reflowar */}
      <div className="flex-1 min-w-0 flex flex-col self-stretch">
        <Topbar
          unidades={unidades.map((u) => ({ id: u.id, nome: u.nome }))}
          unidadeAtivaId={unidadeAtiva.id}
          user={sessionUser}
        />

        {/* Main + Copilot rail lado a lado em xl+; mobile o copilot é FAB flutuante */}
        <main className="flex-1 flex min-w-0">
          {/* min-w-0 + overflow-x-hidden previnem gráficos/tabelas estourarem layout */}
          <div className="flex-1 min-w-0 overflow-x-hidden">{children}</div>
          {!hideClockRail && <ClockRail />}
        </main>
      </div>
    </div>
  );
}

function toSessionUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): SessionUser {
  const meta = user.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    user.email?.split("@")[0] ||
    "Operador";
  const role =
    (typeof meta.role === "string" && meta.role) || "Operador";

  const parts = fullName.trim().split(/\s+/);
  const initials = (
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : parts[0].slice(0, 2)
  ).toUpperCase();

  return {
    id: user.id,
    email: user.email ?? null,
    name: fullName,
    initials,
    role,
  };
}
