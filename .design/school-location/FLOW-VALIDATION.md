# School location browser validation

Validated in Orca's embedded browser at `http://lazuli.lazuli.localhost/ajustes`, using the local
development server and the seeded ADMIN account. This pass exercised real application requests and
database persistence. No lint, unit test, typecheck, format or build command was run.

| Flow | Observed result |
| --- | --- |
| Search and select address | Real AWS suggestions returned; selecting Avenida Paulista resolved coordinates and positioned the map. The debounce now shows loading instead of a premature empty result. |
| Click and drag | Both changed the draft coordinates. A click placed the marker at the clicked screen position without recentering. Dragging changed the saved point. |
| Change radius | 100m and 200m updated the area and selected preset. The marker's screen rectangle stayed identical across the radius change. |
| First-save validation | Missing GPS precision produced visible field validation. The required field is now outside advanced options. |
| Save | The original attempt exposed a stale development Prisma singleton rejecting `addressLabel`. Restarting the server loaded the regenerated client. The real save then returned “Localização salva.” |
| Reopen | Reload retained the selected address, adjusted coordinates, 200m radius and 50m GPS precision entered for this validation. |
| Remove and discard | Removing the address cleared both coordinates and removed the marker. Discard restored the saved label and point. |
| Invalid values | Removing the point and submitting focused the address field. Radius 0 produced its localized error and focused the radius input. |
| GPS failure | Current location did not return a position in this browser. The school-specific recovery message appeared, controls became available again, and the previous point remained. Successful real-device GPS was not validated. |
| Desktop and narrow layout | The map and footer fit the desktop workspace. At 390px emulated width, no horizontal overflow was measured; controls, map and save footer were accessible by scrolling. Physical touch gestures were not validated. |

Intermittent AWS DNS failures were observed during the initial search attempts. DNS later recovered and
the address flow succeeded without mocked AWS responses. Tile failures now use a local reload notice
while preserving map controls; a separate forced tile-network-failure scenario was not exercised.

## Cleanup

The initial settings query returned null. After save/reload validation, only the created test settings
record was removed, guarded by its id, updated timestamp, author and exact saved values. The API query
again returned null and the UI returned to its 200m draft default. No test address or GPS threshold was
left configured. The local development server remains running.
