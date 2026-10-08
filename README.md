# Garment Manager — web app

Next.js (App Router) frontend for the garment management system. The Express API lives in
`../md_backend`; the browser reaches it through the same-origin `/api/v1` rewrite in `next.config.ts`.

Authentication, authorization, sessions, CSRF and deployment notes:
[`../md_backend/docs/authentication.md`](../md_backend/docs/authentication.md).

```bash
cp .env.example .env.local   # API_URL, defaults to http://127.0.0.1:5000
npm run dev                  # http://localhost:3001 (start the API first)

npm run typecheck
npm run lint
npm test                     # Vitest + Testing Library
npm run test:e2e             # Playwright against the real API (see auth docs §16)
npm run build
```

Structure: `app/` holds thin route files, `features/<feature>/` holds api, hooks, schemas,
components and types, `components/ui/` holds the shadcn (Base UI) primitives, and `lib/api-client.ts`
is the single Axios client with CSRF and error handling.
