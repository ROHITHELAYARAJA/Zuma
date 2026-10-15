# Design brief

The latest user-supplied brand PDF is the controlling visual direction. Earlier palette experiments are superseded. The product name remains undecided; “Clinical workspace” is a descriptive working label.

## Brand tokens

| Role | Value | Use |
|---|---|---|
| Canvas | `#FFFFFF` | Clean page and report background |
| Ink | `#111111` | Headings, body text and strong outlines |
| Accent | `#FF5B3E` | Selected highlights, numbered steps and compact accents |
| Highlight surface | `#FFD84D` | Main CTA and selected emphasis panels |
| Border | `#DEDEDE` | Quiet separators and card borders |
| Heading typeface | Space Grotesk | Large typography and section titles |
| Body typeface | DM Sans | Clinical content, UI labels and tables |
| Handwritten typeface | Kalam | One small landing annotation |

Prefer ink text on yellow or orange-red. Computed sRGB contrast is approximately 13.65:1 on yellow and 6.13:1 on orange-red. White on orange-red is approximately 3.08:1, so do not use that combination for normal-size text. The light border is a separator, not the only indication of an interactive state; focus and selected controls need a strong ink outline or another clear visual cue.

## Reference interpretation

These are the user-selected visual references and the intended design translations. They are inspiration, not copied assets or claims about those products. Reference characteristics below describe the supplied design direction; individual remote pages have not been independently audited in this document.

| Reference | Translation for this project |
|---|---|
| Inference Health | Generous spacing and an easy-to-follow workflow narrative. |
| Screenshot 2 / Lomo | Oversized, bold typographic hero with a short, specific value statement. |
| Screenshot 3 / Jan | Thick ink outlines and an offset-shadow CTA, using the brand yellow. |
| Screenshot 4 | One handwritten annotation using Kalam, kept away from clinical facts. |
| CalmSense reference | Rounded supporting cards with consistent spacing. |
| Whisker reference | Dense but orderly tables for records and source evidence. |
| Zendenta reference | Clear clinical navigation with an obvious selected section. |

Do not copy third-party logos, testimonials, staff portraits or trust badges. Do not invent hospital partners, usage counts, clinical outcomes, certifications or live integration claims. Use fictional patient content and explicit synthetic-demo labels.

## Routes and content

- `/`: presentation with the problem, seven capabilities, the two-hospital workflow, and a clear link into the demo. One primary CTA uses a thick outline and offset shadow.
- `/workspace`: the functional application. Keep patient selection, identity review, permission controls, source access, conflicts, chat, review/export and audit navigation intact.
- Keep source availability, dates, units, unresolved conflicts and permission status visible. Visual polish must not hide incomplete evidence.
- A clinical answer remains easy to read and cite. Handwritten text, decorative effects and 3D do not appear inside reports or obscure controls.

## Motion and 3D

Use Motion for small interface transitions, GSAP for a restrained presentation sequence, and Three.js/React Three Fiber only where it explains the connection between two hospitals. A static fallback must communicate the same idea. Respect reduced-motion preferences, keep keyboard focus stable, and pause decorative motion when the page is hidden. No particle or camera effect should interfere with clinical work.

## Design acceptance checks

This is a review checklist, not a claim of completed visual QA. Record actual browser results in the build report.

- Brand colors and typography match the latest PDF throughout both routes.
- The primary CTA and every clinical action work by keyboard and show focus.
- Mobile layouts keep the patient identity, active permission and available-source status readable.
- Tables can scroll without pushing the full page beyond its viewport.
- Motion can be reduced and the UI still explains every action.
- Sources, conflicts and denied access use readable text in addition to color.
- No third-party assets or unsupported trust/clinical claims appear.
- All functional workflow checks in [verification.md](verification.md) still apply after the visual changes.
