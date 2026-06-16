import { LoginForm } from "./login-form";

export const metadata = { title: "Portal do Parceiro · Entrar" };

export default async function ParceiroLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Portal de Parceiros
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Entrar no portal</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Acesse para gerenciar suas ofertas e materiais.
          </p>
        </div>
        <LoginForm initialError={error} />
      </div>
    </main>
  );
}
