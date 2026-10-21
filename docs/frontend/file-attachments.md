# File selection and academic proof uploads

`FileUpload` is exported by `@lazuli/ui`; its examples live in `Components/FileUpload` in Storybook.
The shared picker has no API or storage dependency. It controls a `File[]` through `value` and
`onValueChange`. Consumers supply `accept`, `acceptLabel` and `maxSize` to match server constraints.

`multiple` enables additive selection, with duplicate name/size/modification-time entries ignored.
Empty, unsupported, oversized or excessive selections are rejected as a batch with an announced
message. `onValidationError` lets the surrounding form prevent submission until selection is valid.
Academic proof consumers use `MAX_UPLOAD_FILE_BYTES` from `@lazuli/validators`: 50 MB per file.

The picker button supports keyboard input; drag and drop is optional. `camera` adds native capture
on narrow or touch screens. Image preview object URLs are released when files change or unmount.
`compact` reduces the selection frame for operational forms. `progress` is optional and must come
from transport measurements; missing progress uses an indeterminate indicator. Disabled, uploading
and success states prevent new selection. Motion respects reduced-motion preferences.

Academic grades use one dialog per competence. It selects the unit and groups grade, date,
observations and the compact picker. Written and Listening accept proofs; Oral and Participation
have no proof picker. Files identify phase and competence without requiring an appointment.
Legacy unclassified files remain visible for explicit identification by authorized users.

Saving selected proofs first stores their bytes in the authenticated user's IndexedDB queue.
The success message says files were queued; it does not claim server receipt or processing.
The app-shell queue transfers one file at a time, displays measured progress and distinguishes
receipt, processing, availability, rejection and interruption. Interrupted local bytes survive
reload and require explicit resume. Server receipts reconcile completed transfers and remove
local copies. Account changes remount the queue and abort the previous account's transfer.

Only ready files have download links. Identification, retry and justified removal remain subject
to server authorization; hiding controls is not authorization. Removal is independent from grade
submission. The API owns limits, ownership and byte validation, and processing crosses the worker
boundary. Placement uploads and their shared attachment dialog belong to the entry/commercial
integration block and are not part of this component's current public API.
