# Vercel token

1. Vercel → **Account Settings** → **Tokens**
   (<https://vercel.com/account/settings/tokens>) → **Create Token**.
2. Scope it to the team that owns the projects (or your personal account). Set an
   expiry.
3. If the projects belong to a team, copy the **Team ID**: Team → **Settings** →
   **General** → Team ID (`team_…`).
4. Root `.env`, then restart `pnpm dev`:

   ```bash
   VERCEL_TOKEN="…"
   VERCEL_TEAM_ID="team_…"   # leave empty for personal projects
   ```

5. In Jarvis: **Settings → Provider accounts → Add account**, provider Vercel,
   `VERCEL_TOKEN`. Then open the client → **Add resources**.

A single Vercel project serves both environments, so import it **twice**:

- **Production**: target `production`, branch `main`.
- **Development**: target `preview`, branch `pre-production` (from the linked
  repository's development branch).

The import form fills these in when you switch the environment.

Vercel tokens aren't read-only. Jarvis only makes `GET` requests, but treat the token as
sensitive. A second team can use `VERCEL_TOKEN_<NAME>` + `VERCEL_TEAM_ID_<NAME>`.
