# File attachments

`FileUpload` and `FileAttachmentDialog` are shared primitives exported by `@lazuli/ui`.
Their examples live in `Components/FileUpload` and `Components/FileAttachmentDialog` in Storybook.

## File selection

`FileUpload` controls a `File[]` through `value` and `onValueChange`. Supply `accept`,
`acceptLabel` and `maxSize` to match the server's constraints. `multiple` enables additive
selection; duplicate selections are ignored. Empty, unsupported and oversized files are
rejected with an announced message. `onValidationError` lets a containing form prevent
submission until the selection is valid again.

`maxSizeByType` optionally applies stricter MIME-specific limits within `maxSize`.
Use `sizeLabel` to describe mixed limits accurately, such as 25 MB source images and 5 MB PDFs.
The upload API remains responsible for validating the final bytes and their size.

Placement and academic assessment uploads allow **50 MB per file**. Product consumers and
APIs share `MAX_UPLOAD_FILE_BYTES` from `@lazuli/validators`; the generic picker remains
configurable through `maxSize`.

The picker button supports keyboard input. Drag and drop is an additional desktop input;
it is never required. `camera` exposes a camera action on narrow or touch screens using
the device's native file capture support. Image previews use temporary object URLs that
are released when the selected file changes or the component unmounts.

`renderTrigger({ open, disabled })` replaces the default picker surface for contextual controls
such as an avatar or a section-header attachment button. File type/size validation, selection,
and error announcements remain owned by `FileUpload`.

The states are idle, selected, dragging, invalid, disabled, uploading and success.
`progress` is optional: only pass a percentage measured by the upload transport.
Without it, the transfer uses an indeterminate indicator. Motion respects reduced-motion
preferences.

## Attachment dialog

`FileAttachmentDialog` supplies the event context, selection, submission, retry and completion.
`target` identifies the person or record and the event before submission. Optional children
provide contextual fields, such as an assessment phase. `onAttach` is the upload adapter;
the shared component has no API or storage dependencies.
`compact` uses the compact picker, smaller heading, and closer spacing for focused operational
forms. The default presentation remains available for standalone attachment tasks.

The footer stays outside the scrolling body. While the upload is pending, dismissal and
duplicate submission are blocked. An unsuccessful request retains the selected files.
On success, focus moves to the completion action. `onComplete` can return to the event
to continue another task.

Success copy must describe the milestone actually reached:

- Placement assessments resolve after the server has stored the proof.
- Academic assessments resolve after the files have entered the persistent upload queue.
  Their dialog says that the files are queued, and directs the user to the existing queue
  for transfer progress, interrupted uploads and processing.

## Product entry points

The lead's appointment card opens the placement upload or correction appropriate to its
current state. Teacher placement appointments use the same upload dialog.
Placement corrections may include one optional corrected proof, stored separately from
the applied proof. It uses the same upload flow and file limits. Recording the stage never
requires this extra attachment; opening the upload from the correction form preserves its draft.
Each academic assessment row opens one editing dialog for its competence. The dialog selects
only the unit and groups the grade, optional observations and compact `FileUpload`.
Written and Listening accept proofs; Oral and Participation do not reserve upload space.
New uploads identify the phase and competence without asking for an appointment. Legacy
unclassified files remain visible for explicit identification. Existing authorization, file limits,
storage and processing rules remain owned by their respective APIs.
