# DigitalOcean token

Jarvis only reads from DigitalOcean. It lists App Platform apps (discovery), their
deployments, and component metrics.

1. DigitalOcean control panel → **API** → **Tokens** → **Generate New Token**.
2. Name it e.g. `jarvis-read`. Pick an expiry you're happy to rotate.
3. Scopes: **Custom Scopes** with:
   - `app:read`: list apps, read deployments (discovery, step 8)
   - `monitoring:read`: CPU / memory / restart metrics (step 8)

   **Read Only** also works but grants more than needed.

4. Put the token in the root `.env`:

   ```bash
   DO_API_TOKEN="dop_v1_…"
   ```

   Restart `pnpm dev` so the API picks it up.

5. In Jarvis: **Settings → Provider accounts → Add account**, provider DigitalOcean,
   token "Environment variable", `DO_API_TOKEN` (the seed already created "Inteck
   DigitalOcean"). **Test connection**, then open the client → **Add resources**.

Each environment is a separate App Platform app. Import the production and development
apps separately and confirm the environment for each (Jarvis suggests it from names
like `-dev`, `-staging`, `-preprod` and the deployed branch).

A second DigitalOcean team can use `DO_API_TOKEN_<NAME>`, e.g. `DO_API_TOKEN_ACME`.
