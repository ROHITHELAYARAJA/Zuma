# ZUMA — Ravi synthetic local demo

## Deliverable

`Zuma_Ravi_Synthetic_Demo_45s.mp4` is a 45-second, 1920×1080, 30 fps H.264/AAC product-demo cut. It uses five genuine screenshots of the local synthetic demo UI, compact sidebar scene labels, English narration and a restrained instrumental score.

## Story beats

| Time | Visual | Verified point |
|---|---|---|
| 0:00–0:06.5 | Patient matching | B-507 is linked on matching date-of-birth/contact-token evidence; the lower-score same-name B-811 candidate is kept separate. |
| 0:06.5–0:13.5 | Consent center | Synthetic treatment permission is active for 24 hours across the selected record categories. |
| 0:13.5–0:23.5 | Source comparison | The records show a penicillin-allergy conflict, differing metformin instructions, and two dated glucose values. |
| 0:23.5–0:34 | Evidence draft and timeline | Source coverage, record dates, and evidence context remain visible; the glucose change is not presented as a diagnosis. |
| 0:34–0:45 | Clinician review | The deterministic draft is marked for clinician review. No approval or export was submitted. |

## Accuracy and safety notes

- Ravi and all records shown are synthetic. The app footer identifies this as a local prototype, not connected to live hospitals or ABDM.
- The local summary is deterministic. No live LLM, vector RAG, diagnosis, or treatment recommendation is presented.
- Cross-hospital chat was not invoked: the local chat route requires configured AWS knowledge-base retrieval. No records were uploaded to AWS for this video.
- The review modal was opened for capture only. The “Approve this version” and “Export approved report” actions were not selected.
- The source comparison preserves the conflicting statements rather than resolving them automatically; clinician verification is required.

## Rebuild

Run from PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\build-video.ps1
```

The script uses the included screenshots, `voiceover-final.wav`, `score.wav`, and `captions.ass`. It applies a subtle deterministic FFmpeg zoom, hard cuts between UI states, voice/music mixing, H.264 encoding, and validates duration, resolution, frame rate, and frame count.

## Audio provenance

Narration uses the Charon English studio voice. A local ACE-Step 1.5 executable/integration was not available in the inspected project folders during this run, so the instrumental fallback was generated with the available music-generation tool and then trimmed/mixed by FFmpeg. The provided score includes no vocals.

## Narration transcript

Meet Ravi Kumar, a fictional patient in this local Zuma demo. A matching birth date and contact token support one link; a same-name record stays separate. Scoped treatment consent unlocks the synthetic records for twenty-four hours. The source records show a penicillin allergy at one hospital, and none at another. Metformin instructions differ. Dates and sources remain visible; a changing glucose value is shown as a trend, not a diagnosis. This deterministic summary is not a live AI answer. A clinician must verify it before approval or export. Synthetic data only; no live hospital connection.
