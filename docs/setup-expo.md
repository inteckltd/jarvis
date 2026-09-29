# Expo / EAS token

Prefer a **robot user** so the token isn't tied to a person.

1. expo.dev → your organisation → **Settings** → **Members** → **Robots** (or
   **Access tokens** for a personal token) → create a robot with the lowest role that
   can read projects and builds (Viewer; use Developer if builds don't appear).
2. Create an access token for it and put it in the root `.env`, then restart
   `pnpm dev`:

   ```bash
   EXPO_TOKEN="…"
   ```

3. In Jarvis: **Settings → Provider accounts → Add account**, provider Expo,
   `EXPO_TOKEN`. Then open the client → **Add resources**.

Mobile apps have no environment. Import them with environment **None**. In the import
form, add the iOS bundle ID and App Store app ID so the live App Store version can be
checked (step 12), plus the Android package for later.
