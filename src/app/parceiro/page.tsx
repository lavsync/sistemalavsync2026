import { redirect } from "next/navigation";
import { createClient } from "@mi/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ParceiroIndex() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/parceiro/dashboard");
  redirect("/login");
}
