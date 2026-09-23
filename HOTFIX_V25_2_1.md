# Dusk Industries v25.2.1 Hotfix

Fixes the TypeScript build failure in `SocialProviderPanel.tsx` where the
provider union still included Telegram/Snapchat inside callback closures even
though the rendered controls are only for X/Instagram.

No SQL changes.
No environment-variable changes.
No Make changes.

Deploy this package over v25.2 and rebuild.
