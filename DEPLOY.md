# LavSync · Guia de Deploy

Passo a passo para colocar a aplicação em produção em **sistema.lavsync.com.br** com a mesma UI da prévia local.

---

## 1. Supabase — preparar o backend

1. Acesse o projeto `yjesmmuoqrlteclwtfqn` em https://supabase.com/dashboard
2. **SQL Editor → New query** → cole o conteúdo de `supabase/migrations/0001_init.sql` → **Run**
3. **Authentication → Users → Add user** (email + senha):
   - Email: `danielqueirozrd@gmail.com`
   - Password: `Lavsync2026#`
   - Marque "Auto Confirm User"
4. **SQL Editor → New query** → cole o conteúdo de `supabase/seed.sql` → **Run**
   (cria o tenant Xô Varal + 3 unidades + vincula seu user como `master`)
5. **Settings → Database → Connection string → URI (Pooler 6543)** → copie pra `DATABASE_URL` no `.env.local`

### Testar local

```bash
cd /Users/danielqueiroz137/Desktop/LavSync
npm run dev
# abra http://localhost:3000  → deve redirecionar pra /login
# entre com danielqueirozrd@gmail.com / Lavsync2026#
```

---

## 2. GitHub — publicar repositório

> Pré-requisito: criar o repo `lavsync/sistemalavsync2026` (vazio) em github.com.

```bash
cd /Users/danielqueiroz137/Desktop/LavSync

# .git já existe; verifique o remote
git remote -v

# Se não tiver remote, adicione (substitua $GITHUB_TOKEN pelo PAT do .env.local):
git remote add origin https://${GITHUB_TOKEN}@github.com/lavsync/sistemalavsync2026.git

# Stage + commit
git add .
git commit -m "feat: foundation v0.1 — sidebar gradiente, auth Supabase, multi-tenant schema"

# Push (precisa do GITHUB_TOKEN/PAT no remote URL ou via gh CLI)
git push -u origin main
```

> ⚠️ Confirme que `.env.local` está em `.gitignore` antes de qualquer commit. Já está.

---

## 3. Vercel — deploy + domínio

### Opção A · CLI (recomendado, usa o VERCEL_TOKEN)

```bash
cd /Users/danielqueiroz137/Desktop/LavSync
npx vercel link --yes --token $VERCEL_TOKEN
npx vercel env pull --token $VERCEL_TOKEN  # sincroniza vars locais

# Subir env vars de produção (uma a uma):
echo "https://yjesmmuoqrlteclwtfqn.supabase.co" | npx vercel env add NEXT_PUBLIC_SUPABASE_URL production --token $VERCEL_TOKEN
echo "$NEXT_PUBLIC_SUPABASE_ANON_KEY" | npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production --token $VERCEL_TOKEN
echo "$SUPABASE_SERVICE_ROLE_KEY" | npx vercel env add SUPABASE_SERVICE_ROLE_KEY production --token $VERCEL_TOKEN
echo "https://sistema.lavsync.com.br" | npx vercel env add NEXT_PUBLIC_APP_URL production --token $VERCEL_TOKEN
echo "production" | npx vercel env add NEXT_PUBLIC_APP_ENV production --token $VERCEL_TOKEN

# Deploy
npx vercel --prod --token $VERCEL_TOKEN
```

### Opção B · Dashboard

1. https://vercel.com/new → importe `lavsync/sistemalavsync2026`
2. Framework: **Next.js** (auto-detect)
3. Environment Variables — copie do `.env.local` (todas exceto `VERCEL_TOKEN` e `GITHUB_TOKEN`)
4. **Deploy**

### Conectar domínio

1. Vercel → Project → **Settings → Domains** → Add `sistema.lavsync.com.br`
2. No painel do registrador (Registro.br), crie:
   - Tipo `CNAME` · Nome `sistema` · Valor `cname.vercel-dns.com`
3. Aguarde propagação (5–60 min) e Vercel emite SSL automaticamente.

### Atualizar Supabase Auth

Após o domínio ativar:
1. Supabase → **Authentication → URL Configuration**:
   - Site URL: `https://sistema.lavsync.com.br`
   - Redirect URLs: adicione `https://sistema.lavsync.com.br/**`

---

## 4. Pós-deploy — validações

- [ ] `https://sistema.lavsync.com.br` abre e redireciona pra `/login`
- [ ] Login com `danielqueirozrd@gmail.com` funciona
- [ ] Sidebar mostra "Daniel Queiroz" + papel "master"
- [ ] Logout volta pra `/login`
- [ ] Tentar `/metricas` deslogado redireciona

---

## 5. Rotação de credenciais (faça AGORA)

As chaves abaixo foram expostas no chat — rotacione:

| Onde | O que fazer |
|---|---|
| Supabase → Settings → API | **Reset service_role key** |
| Vercel → Account → Tokens | ✅ rotacionado em 2026-05-15 (`vcp_0jDvg...`) |
| GitHub → Settings → Tokens | ✅ PAT criado em 2026-05-15 (`ghp_VaO0k...`, escopos `repo` + `workflow`) |

Atualize `.env.local` e o Vercel com as novas chaves após rotação.
