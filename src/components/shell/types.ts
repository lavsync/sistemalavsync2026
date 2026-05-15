// Tipos compartilhados entre Server e Client Components do shell.
// Mantidos isolados para evitar que imports type-only do Sidebar (Client)
// puxem app-shell.tsx (Server) para o bundle do navegador.

export type SessionUser = {
  id: string;
  email: string | null;
  name: string;
  initials: string;
  role: string;
};
