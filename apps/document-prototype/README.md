# Document capture prototype

Disposable experiment for document cropping and OCR, separate from student records.
Deployed to staging on 2026-10-26. The UI direction is provisional, not a validated product design.

## Run locally

From the repository root:

```sh
pnpm --filter @lazuli/document-prototype build
LAZULI_ENV=local AWS_PROFILE=lazuli PROTOTYPE_ADMIN_SECRET=<random-secret-at-least-32-characters> pnpm --filter @lazuli/document-prototype start
```

The server listens on `127.0.0.1:3099`. An operator issues a session via
`POST /document-prototype/internal/sessions` with `x-prototype-admin`. The returned
random token goes in the fragment of `/document-prototype/#<token>`; the phone
needs no login. Issuance requires the operator secret; do not expose it in the UI.
Sessions have no time expiration or per-session OCR attempt limit for this experiment.
Restart revokes every session. Fields are extracted by `@lazuli/domain` using document family, labels and geometry; missing
or ambiguous values remain empty and must be reviewed against the original document.

Scanic detects edges and provides manual corner adjustment. Up to two cropped sides
are composed into one JPEG and sent to Textract DetectDocumentText in a dedicated
worker thread. Images and OCR results live only in memory. No student database,
file storage or Hatchet integration is involved. The worker is an experiment, not the
production worker-boundary implementation.

## Validation and deployment

- Build, session isolation and field extraction tests and infrastructure typecheck pass.
- Browser flow against staging: automatic edge detection, manual keyboard corner adjustment,
  crop, upload and real Textract OCR returned `DOCUMENTO DE TESTE` and `Nome: Maria Exemplo`
  from a synthetic image. Desktop and a 390px-wide content area were inspected; physical
  phone camera capture remains for the owner to evaluate.
- Staging-only Textract permission was provisioned through Pulumi with
  `lazuli:documentPrototype=true`; production was not changed.
- Container `lazuli-document-prototype` uses the existing application image's Node runtime,
  a read-only bundle mount and a separate environment file. It does not replace web/worker.
- Public prototype and existing login return 200; public session issuance returns 404.
- `python3 apps/document-prototype/issue-session.py` issues a fresh non-expiring test link using
  the operator's AWS profile through SSM. The admin secret remains on the server.
- `deploy.sh` runs on the staging EC2 with a private S3 bundle URI. The current bundle is
  `s3://lazuli-staging-private-files-dc8dd46/prototypes/document-prototype/build.tar.gz`.
  The main application deploy rewrites Caddy configuration, so it can remove this temporary route.

The prototype is served behind the staging HTTPS proxy at `/document-prototype/`.
On removal, restore the previous proxy configuration, remove the prototype container,
its bundle/environment files and the private S3 deployment bundle; disable
`documentPrototype` in the staging Pulumi configuration and apply removal of the
Textract policy. No document photos are stored in that deployment bucket.

The extraction core lives in `packages/domain/src/identity-extraction`; the UI shows the
recognized family and distinguishes CIN RG absence, ambiguity and invalid readings. The
prototype remains separate from production student records and production upload orchestration.
