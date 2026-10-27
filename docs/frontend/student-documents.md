# Student documents

The first enrollment step keeps the original vertical groups: identification, contact, then
guardian. Name fields take their group width; birth date/document and phone/email stay paired. One "Anexos" button sits beside the student name input and opens the dark document panel to the right of the form,
without a second modal or a dedicated button row. Upload, crop, preview, extracted data and the
optional QR view stay inside that side panel. The panel groups student identity, guardian identity and
residence proof; each upload action opens the desktop file picker directly. The student photo uses a
clickable empty avatar beside the "Novo aluno" heading at the top of the modal. The attachment button remains beside the student name input. It uploads an existing photo without a camera action.

The secondary QR icon action opens a separate QR dialog only on request. One capability
link serves the registration session. The same capture component accepts files from the desktop
and the public `/documentos` mobile page.
Images are selected with `FileUpload`; documents use Scanic corner adjustment. Identity front and
back are combined into one JPEG before upload. Student photos bypass document cropping and OCR.
Document inputs accept JPG, PNG and PDF; student photos accept JPG and PNG only. The stored
upload is limited to 5 MB. PDFs retain the original bytes and all pages, bypass image cropping
and are marked ready without OCR. The interface explicitly asks for manual data review for PDFs;
automatic identity extraction remains available for image uploads. PDF previews render with PDF.js
and previous/next-page controls, keeping the original opening link available even if rendering fails.

Registration offers student identity, guardian identity and residence proof; photos are separate
from the document list. Enrollment-payment proof is removed from both registration and the mobile
list. Its storage kind remains for existing records; the fee and its collection remain financial
features outside this flow.

`StudentDocumentSession` owns an unguessable, hashed capability and an optional student link.
Staff administration creates it. While open, the capability uploads, reads processing status,
and previews only this session's files and minimal extracted fields on the mobile page. Each
preview request carries the bearer token in its authorization header, never the image URL.
Closing the session revokes all these capabilities. Staff can also review linked files through
the authenticated registration interface. Files are private through
`@lazuli/storage`; metadata and extracted values stay in PostgreSQL.

Enrollment links the session to the saved student in its existing transaction, then closes the
capability. Closing the enrollment UI also closes its session. Existing-student photo uploads are
linked immediately. Sessions have no clock-based expiry; explicit closure revokes the link.
Draft files from an abandoned registration are not attached to another student automatically.

Identity files enter a durable `RECEIVED` state and dispatch `student-document-process` through
Hatchet with only the file ID. The worker claims the record and invokes `IdentityOcr`, currently
implemented with Textract DetectDocumentText. The recovery loop remains a fallback for failed
dispatch or interrupted work; claims prevent duplicate processing. Hatchet receives status only,
never the extracted values or image contents. OCR geometry is interpreted
by the domain extractor. Completion is fenced by the processing timestamp so an old result cannot
replace a newer upload. Failures preserve the file and allow a replacement upload; logs contain no
OCR text or student fields.

The enrollment UI polls for results. It fills supported empty fields and can replace its own
previous automatic values, preserving manual edits and existing registration values. The contextual "Conferir" action
also exposes the four extracted fields for review. Guardian extraction only populates the guardian
name because the current enrollment form does not edit the guardian's document or birth date.
Both capture and enrollment explain that the reading requires human review.

Student profiles display a private photo or an empty avatar with an upload action. Teacher profile
photos are outside this slice and remain pending in issue #219.

After upload, desktop and mobile retain an image preview and display extraction results inline.
A polite toast announces processing; each identity shows a small loading indicator without
blocking other attachments. The mobile header uses the shared Lazuli brand and left-aligned back
navigation. Polling goes through Lazuli's authorized API to read PostgreSQL, which remains the
source of document state/results; browser clients never receive Hatchet credentials.

## Full registration viewer

“Informações cadastrais” opens a wide dialog. The header identifies the student; the left column groups
student data, contact, guardian, address and notes. Phone values link to WhatsApp and email values
link to mail; separate contact buttons are omitted. Each data section has a contextual edit action.

The right column features a large, contained document preview and a selector above the preview.
Missing student identity, guardian identity, residence proof and photo remain selectable. Their
preview offers attachment without creating a file or session until upload starts. The default
selection favors an attached identity document, then any attached file. All linked session files
remain accessible, including legacy payment files. Existing files offer opening the original and
sending another version. The theme surface is shared with the record, without a fixed black panel.
Photo previews display the image on a transparent, borderless viewer; the source image is preserved.

The modal opens with a centered scale/opacity transition. Document selection uses a brief opacity
reveal within a stable preview area. Reduced-motion preference removes spatial animation. Narrow
layouts switch between data and documents and keep the four standard document selectors visible without horizontal
scrolling. Extra historical versions retain distinct accessible labels.

Editing uses the existing contact/guardian/address and notes APIs. Each section saves independently;
validation focuses the first invalid control. Canceling or closing with unsaved changes asks before
discarding. Saving and active uploads block closure. Successful saves refresh the student profile
and listing. Dates and phones use Brazilian masks. Shared guardian updates follow the existing API.

Upload capture stays inside the document area and reuses the enrollment crop/upload flow. Sessions
use the existing student ID, so successful uploads link immediately. Returning or closing capture
closes the session. New versions preserve earlier files; photo and document queries refresh after
upload. OCR does not overwrite saved registration fields.

Deletion is available in the registration viewer, enrollment attachment review and the open mobile
session. It requires a separate confirmation, keeps other versions and registration values, removes
the private storage object and marks the metadata deleted. Upload and deletion serialize through
the session row; deleted processing records cannot receive late OCR results. Staff must be an
administrator with access to the linked student or own the draft session. Mobile deletion is scoped
to the current open capability session. Photo, document and enrollment queries refresh after deletion.

Browser validation exercised student-data save, date/email validation, cancel/discard, notes save
and persistence after reload (temporary fixture note restored), contact links, light/dark display,
mobile document selection and reduced motion. Subsequent Orca validation uploaded a two-page PDF,
confirmed the original bytes and both pages after reload, rendered the PDF preview, and deleted
the validation attachment through the confirmation dialog. The deleted file returned 404 and the
existing student photo remained available. The mobile PDF/deletion flow has not been exercised end to end.
