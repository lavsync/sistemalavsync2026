// Server Component — encapsula a Server Action de logout.
// Renderizado dentro do Sidebar (Client) via prop slot, evitando que
// o bundle cliente precise importar @/lib/supabase/server.
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/login/actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        aria-label="Sair"
        title="Sair"
        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white/55 hover:text-white hover:bg-white/8 transition-colors"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </form>
  );
}
