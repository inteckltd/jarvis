# Supabase access token (client projects)

This is for the Supabase projects Jarvis **monitors** (e.g. the IDS prod and dev
databases). It is separate from Jarvis's own Supabase project, which is configured
with `DATABASE_URL` / `NEXT_PUBLIC_SUPABASE_*`.

1. Supabase dashboard → your avatar → **Account preferences** → **Access Tokens**
   (<https://supabase.com/dashboard/account/tokens>) → **Generate new token**.
2. Name it `jarvis-read`.
3. Put it in the root `.env` and restart `pnpm dev`:

   ```bash
   SUPABASE_ACCESS_TOKEN="sbp_…"
   ```

4. In Jarvis: **Settings → Provider accounts → Add account**, provider Supabase,
   `SUPABASE_ACCESS_TOKEN`. Then open the client → **Add resources**.

Discovery lists every project the token's account can see. Each project appears twice:
as the **database** and as its **edge functions**. Import the ones you want and set the
environment on each.

Personal access tokens can't be scoped. They have the same access as your Supabase
account, so keep this token in the API environment only. Use a dedicated Supabase
user with access to just the relevant organisations if possible.

Database metrics (CPU, memory, disk, connections) also need each project's service
role key. That's added per resource in step 9.
