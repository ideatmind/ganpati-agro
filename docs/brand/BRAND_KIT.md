# Digital brand kit

The original production site is the interaction and composition reference: centered full-screen hero, glowing emblem, transparent-to-solid navigation, generous rounded fieldsets, agricultural line motifs, and calm reveal motion. V2 preserves these recognizable patterns while applying the supplied brand-kit colors and the standard ₹500 and focused ₹2,500 membership messaging.

**Essence:** Growing Farmers. Building Futures.

The experience should feel grounded, trustworthy, empowering, and progressive. It uses real agricultural imagery, direct language, large touch targets, minimal decoration, and one clear primary action per screen.

## Palette

| Token | Value | Use |
|---|---|---|
| Ganpati Green | `#1F6B3A` | Primary actions, navigation, headings |
| Deep Agricultural Green | `#123B24` | Hero overlays, footer, authority |
| Harvest Gold | `#D99A2B` | Restrained highlights and key statistics |
| Fresh Leaf | `#6FAF45` | Positive states |
| Earth Brown | `#7A5635` | Rural warmth |
| Sky Blue | `#3D8FBF` | Information states |
| Warm White | `#FAFAF7` | Page background |
| Surface | `#FFFFFF` | Cards and forms |
| Border | `#DDE2DA` | Dividers and inputs |
| Primary text | `#1C241E` | Main text |
| Secondary text | `#58665B` | Supporting text |

Use roughly 60% neutral, 30% green, and 10% accent.

## Typography and layout

Noto Sans Devanagari and Poppins are self-hosted through Fontsource. All pages share the same body stack; numeric totals use Poppins with tabular numbers. Spacing follows an 8px grid, primary controls have 48px touch targets and an 8px radius, and cards use a 16px radius with subtle borders and shadows. Keyboard focus uses a visible warm outline.

The shared tokens in src/app/theme.css are the source of truth for public pages, registration, login, receipts, employee/member dashboards, admin screens and error states. Reuse brand and semantic tokens for surfaces, borders, feedback and typography. Keep page-specific layout and the original homepage hero, illustrations and motion; avoid local replacement palettes. Dense administrative controls may use 44px touch targets.
