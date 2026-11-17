---
version: 1
slug: "features-student-attendance-settings-tsx-6ba8ad91"
primary_target: "apps/web/src/features/student-attendance/settings.tsx"
related_targets: ["apps/web/src/features/settings/settings-home.tsx","apps/web/src/features/student-attendance/settings-fields.tsx","apps/web/src/features/student-attendance/location-map.tsx"]
---

# School location in Settings

Mode: Operate. Extend the established Lazuli interface; preserve its semantic tokens and shared controls.

The user selected a wide interactive map with a compact side panel for address and radius on 2026-11-16.
Move the standalone sidebar entry into Settings. Preserve ADMIN and SYSTEM_ADMIN access to location;
financial settings remain restricted to SYSTEM_ADMIN. Existing links redirect to the new location.

THESIS: Locate the school and confirm the attendance area visually, without asking staff to find coordinates.
OWN-WORLD: Lazuli's dark navy/neutral surfaces, existing typography, precise restrained blue emphasis,
shared inputs and buttons. The geographic map is working content, with real AWS cartography and attribution.
STORY: Search a Brazilian address, select a result, adjust the draggable entrance marker, set the attendance
radius, inspect the live circle, and explicitly save. Current location and manual coordinates remain fallbacks.
FIRST VIEWPORT: The compact Settings title and section tabs share one desktop header row above one
coherent workspace. The workspace fills the remaining desktop viewport: a compact control panel on the
left, a wide map on the right, and a persistent footer row containing feedback and Save location. The
control panel scrolls internally when needed so the map and save action remain available. Address search
leads, chosen location remains readable,
radius and required GPS accuracy use short visible fields with meters and explicit radius presets.
Coordinates sit in advanced controls, expanding on coordinate validation errors. A quiet footer owns one dominant Save location action and saved,
unsaved, or error feedback. At widths up to 960px the layout becomes a scrolling single column with
controls before a map of at least 25rem height and the footer after it; the header may wrap.
FORM: User-selected map and side panel inside existing Settings. No concept seed required for this precise
extension. Keep map motion purposeful: move to the selected address, update marker and circle together,
respect reduced motion. Search, map, GPS and save failures stay local and preserve the draft.
Direct map placement and radius changes preserve the camera. Address selection, current location,
discard and the recenter control explicitly move it. Removing the selected address clears the draft point.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict,
DESIGN.md, and every shipping raster carrying its provenance. This ordinary extension preserves the
incumbent global design files; map tiles are provider content and retain attribution, with no generated art.

Evidence status (2026-11-16): the compact header and viewport layout are recorded from source. Current
authenticated desktop and mobile captures are absent. Finish disposition is recapture for that missing
evidence only; no visual ship verdict or source rejection is established. Checks remain deferred at the
user's explicit instruction. See `.design/school-location/OUTCOME.md` for implementation and runtime limits.

No invented school addresses or GPS limits, no student data in map
requests. Saved location changes apply to new attendance windows. Runtime AWS permissions are prepared
in Pulumi; infrastructure application is reported separately from local implementation.

The user subsequently requested a default attendance radius of 200m. Initialize that draft value only
when no radius has been saved; preserve existing settings and keep saving explicit.
