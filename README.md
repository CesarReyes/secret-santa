# Amigo Secreto

PWA para jugar al amigo secreto con familia y amigos: sorteo que solo conoce quien regala, listas de deseos, chat anónimo y muro del grupo.

**App:** https://cesarreyes.github.io/secret-santa/

La propuesta completa (alcance, diseño del sorteo cifrado, modelo de datos) está en [docs/propuesta.md](docs/propuesta.md).

## Instalar en el teléfono

- **iPhone (Safari):** abre la URL, toca Compartir y luego **Agregar a pantalla de inicio**.
- **Android (Chrome):** abre la URL, toca el menú ⋮ y luego **Instalar app**.

## Stack

React 18 + TypeScript + Vite, Tailwind v4 + shadcn/ui, React Router (hash), TanStack Query, zustand, Supabase (Postgres + RLS, Auth, Storage, Realtime, Edge Functions) y `vite-plugin-pwa`.

## Desarrollo

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

`.env` trae la URL y la llave publicable de Supabase. Es pública por diseño; los datos los protege RLS. Los secretos viven en Supabase, nunca en el repo.

Cada push a `main` corre los tests, compila y publica en GitHub Pages.

## Supabase

Proyecto `qpqdykhtsfygppibxzoo`. El esquema está en `supabase/migrations`, la función de cuentas en `supabase/functions/accounts` y las reglas compartidas con la app en `supabase/functions/_shared`.

`supabase db push` se queda colgado en "Initialising login role" con este proyecto, así que las migraciones se aplican por la API de administración y se registran a mano:

```bash
supabase db query --linked -f supabase/migrations/<archivo>.sql
```

```bash
supabase db query --linked "insert into supabase_migrations.schema_migrations (version, name) values ('<version>', '<nombre>')"
```

```bash
supabase functions deploy accounts --use-api --project-ref qpqdykhtsfygppibxzoo
```

```bash
supabase functions deploy draw --use-api --project-ref qpqdykhtsfygppibxzoo
```

```bash
supabase functions deploy link-preview --use-api --project-ref qpqdykhtsfygppibxzoo
```

La función `accounts` usa el secreto `KEY_PEPPER_SECRET` para proteger los respaldos de llaves. Ya está configurado y **no se debe cambiar nunca**: hacerlo deja a todos sin poder abrir su sorteo en un teléfono nuevo.

```bash
supabase config push
```

En `config.toml`, `[auth.email] enable_signup` debe quedarse en `true`: en proyectos alojados también activa el login con correo y contraseña. Las altas se bloquean con `[auth] enable_signup = false`.
