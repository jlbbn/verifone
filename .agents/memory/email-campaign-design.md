---
name: Email campaign design rules
description: User-confirmed visual rules for the Banxico Plus internal email campaign (Resend scripts in scripts/)
---

# Email campaign design rules (Banxico Plus internal campaign)

Authoritative visual reference: `attached_assets/campana-banxico-plus_1786004347172.html` (dark campaign template).

**Palette:** paper #0F0F12 · bg #1A1A1E · red #E8332B · red-deep #B8241D · green #3DDC84 · line #26262B · gray #9A9AA2 · gray-soft #6D6D76.

**Structure:** dark rounded card, 3px top bar (red, or green for success), 2×2 red-square brand mark + `BANXICO+`, live-dot status, uppercase kicker, big h1 with ONE accent span, sections with 3px red left-bar headings, pill status badges, footer with EMV/PCI DSS/AES-256/TRC-20 badges + Laredo TX address.

**User explicitly rejected (do not reintroduce):**
- Colored-font spans scattered through body text ("no hagas eso de poner las fuentes de colores") — one accent span in the h1 is the ceiling.
- Emojis and AI-generated image icons.
- Any "urgent/blocked/work stopped" framing. Failures ARE shown, but always as part of ongoing work ("run continues", "period ongoing").

**Why:** each rule came from a direct user correction after seeing sent emails.

**How to apply:** any new send script in `scripts/` must follow this template. Latest generation (`scripts/phase3-preaudit.ts`) adds approved "automated" visual devices: run-metadata card (RUN ID/ENV/TRIGGER/PERIOD), T1–T5 suite-state matrix, mac-style terminal log blocks, before/after CSS metric bars, progressive elapsed clock. Emails in English unless user pastes Spanish content; user chats in Spanish.
