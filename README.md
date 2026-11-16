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
