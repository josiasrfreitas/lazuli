# School location outcome

Recorded 2026-11-16 from source and the implementation session. This is an ordinary extension of the
incumbent Lazuli design system. The selected surface brief is
`apps/web/.impeccable/surfaces/features-student-attendance-settings-tsx-6ba8ad91.md`.
Global design files, unrelated calendar work, and unrelated sidebar changes remain outside this record.

## Implemented source

- `settings/settings-home.tsx` places the Ajustes title and the SYSTEM_ADMIN section tabs in the same
  header. Its stylesheet uses a compact wrapping flex row and a full-height desktop page/panel chain.
  ADMIN users receive the location panel; the finance panel and tabs are conditional on SYSTEM_ADMIN.
- `student-attendance/settings.module.css` defines a desktop workspace with a 17–21rem control column,
  a flexible map column, and an automatic footer row spanning both. The workspace consumes remaining
  height and the controls can scroll internally. Up to 960px, it becomes a scrolling single column with
  controls first, a map with a 25rem minimum height, and the footer afterward. These are source layout
  rules; their fit in the authenticated application has not been visually confirmed.
- `settings-fields.tsx` provides address search, current-location fallback, a radius field with meter
  units and explicit 50/100/200m presets, and advanced GPS accuracy and coordinate fields. Validation
  errors expand the advanced controls. The footer exposes unsaved/saved/error feedback, discard, and
  an explicit save action. At the user's request, a missing radius starts at 200m; saved radii are preserved.
- `location-search.ts` debounces searches by 350ms after three characters and resolves a selected
  result before updating the draft point and label. `address-search.ts` uses Amazon Location Places
  autocomplete restricted to Brazil in Portuguese, then GetPlace with storage intent for coordinates.
- `location-map.tsx`, `use-location-map.ts`, and `location-map-model.ts` implement MapLibre with AWS
  Standard cartography, click/drag positioning, keyboard Enter placement at the map center, zoom and
  recenter controls, and a geographic radius polygon. Recenter/point movement honors reduced motion.
  Map errors offer retry and keep draft data available through the form. Provider attribution is retained.
  A reported map failure was traced to the browser error `Worker failed to load`. The hook now explicitly
  registers the MapLibre worker asset with `setWorkerUrl` using the documented Next.js URL pattern.
- `settings-model.ts` keeps a draft and saved baseline, validates through the shared schema, and saves
  through `studentAttendance.saveSettings`. The API upserts the school settings row, including the new
  address label. GPS, address resolution, and save failures have local feedback in the source.
- `/ajustes`, attendance settings API procedures, address search/location procedures, and the map
  proxy preserve ADMIN/SYSTEM_ADMIN access. The old `/configuracoes/presenca` route redirects to
  `/ajustes?secao=localizacao`. The Ajustes navigation entry allows both roles; finance read/save API
  procedures remain SYSTEM_ADMIN-only.

The surface uses existing semantic colors, typography, radius, buttons, inputs, and form sections.
No raster artwork was authored; AWS map tiles are provider content with attribution.

## Intended workflow

Open Ajustes, search for the Brazilian school address, choose a result, adjust the entrance marker,
set and inspect the attendance radius, and select Salvar localização. Current location and manual
coordinates provide fallbacks. The form explains that new attendance links use the area. Source wiring
supports this workflow; no end-to-end success is claimed here.

## Migration and deployment

`20261116230000_school_location_address/migration.sql` adds the nullable `address_label` column to
`AttendanceSettings`. The implementation session reports that this additive migration was applied
locally, without resetting data or loading fixtures. Deployment environments still require their normal
migration application.

`infra/pulumi/compute.ts` prepares runtime `geo-maps:GetTile` permission for
`arn:aws:geo-maps:us-east-2::provider/default`, alongside the existing Places actions. Preparing the
policy in source does not establish that infrastructure was deployed or that the runtime identity has
the permission. An AWS style read succeeded earlier in the session; it does not establish tile rendering,
address search, or persistence through the application.

## Evidence limits and finish disposition

The subsequent full workflow pass is recorded in `FLOW-VALIDATION.md`. It verified real save/reload,
address search, point adjustment, radius changes, removal/discard, validation and the GPS failure path.
It also moved required GPS precision into the visible controls, removed unsolicited camera movement,
fixed clearing the selected location, and restored the initial empty settings after persistence testing.
This later evidence supersedes earlier claims below that saving was not exercised.

### Map incident follow-up

A later direct-click report was reproduced by clicking the country map at viewport position (800, 400).
Zooming to that point requested vector tiles for which AWS returned HTTP 200 with an undefined Blob
(confirmed through the SDK for tile 17/49649/69806). The integration incorrectly converted this success
into HTTP 503, which triggered the full-map error overlay. Successful empty vector tiles now return
an empty protobuf body; a missing style body still fails. The exact tile returned HTTP 200 and zero bytes
through the authenticated application, and the same click kept the marker and 200m circle available
after loading. Temporary diagnostic logging was removed. This was runtime browser/API investigation;
no lint, test, typecheck or build command was run.

The reported failure was reproduced in Orca at `http://lazuli.lazuli.localhost/ajustes`.
The proxy's internal request origin leaked into descriptor tile URLs as `http://localhost:3000`,
and browser CORS failures prevented rendering. The API now emits root-relative tile URLs and the
client resolves requests against the page URL. Descriptor revision `v=2` bypasses the prior cached
descriptor. A separate address-selection crash used the removed `LngLat.toBounds` method; it now
uses `LngLatBounds.fromLngLat`, available in the installed MapLibre version.

Browser investigation confirmed rendered country cartography, address autocomplete and selection,
the entrance marker and a 200m circle. Changing the radius and recentering were exercised on localhost;
the same address-selection flow was then repeated on the user's exact local domain. No school location
was saved. A 390px layout capture on localhost showed the map below the controls without horizontal
overflow. These observations supersede the earlier missing-browser-evidence statement for these flows
only; persistence, GPS permission and production deployment remain unverified. No test, lint, typecheck,
build or formatting gate was run during this investigation.

At the initial handover, authenticated desktop and mobile captures were unavailable. The user's earlier header screenshot
predates the current one-row header and cannot demonstrate the final layout. The finish disposition is
**recapture**, solely because current visual evidence is missing. There is no visual ship verdict and no
source rejection on that basis. Desktop viewport fit, mobile overflow, map rendering, and interaction
quality remain unconfirmed in the browser.

The user explicitly prohibited running checks. No lint, typecheck, tests, build, formatting check,
diff check, detector, or browser automation was run for this documentation pass. A web typecheck started
earlier was terminated at the user's request and has no successful result. Those checks remain deferred
to an authorized delivery gate or CI. Tiles, address selection, and save were not exercised end-to-end.
