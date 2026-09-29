# Workspace Instructions

- This is an Expo SDK 57 React Native app. Routes belong in `src/app/`; keep domain logic and reusable components outside that directory.
- Keep app copy in Traditional Chinese (`zh-Hant`) and the default currency TWD.
- Store money as integer minor units; never use floating-point values for ledger arithmetic.
- The current app is local-only. Do not display a cloud-connected state until authentication and synchronization have been implemented and verified.
- Supabase configuration must use `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Never add service-role keys or real credentials to source control.
- Keep household isolation in database policy, not only in client filtering. Validate RLS with separate test households before enabling production data.
- Run `npm test`, `npm run typecheck`, and `npm run lint` after relevant changes.