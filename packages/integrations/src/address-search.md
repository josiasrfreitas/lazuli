# Student address lookup

The student intake address step calls the authenticated `addresses.search` and
`addresses.resolve` procedures. Amazon Location Places v2 runs on the server using
`@aws-sdk/client-geo-places` and the standard AWS credential chain. No browser API key
is needed. `AWS_LOCATION_REGION` selects the Places region, falling back to `AWS_REGION` and then
`us-east-2`. Local configuration uses `us-east-2`, which is permitted by the organization. Local development
needs a valid AWS profile/session; the local S3 credentials do not authenticate Places.

Required permissions are `geo-places:Autocomplete` and `geo-places:GetPlace` on
`arn:aws:geo-places:us-east-2::provider/default`. The runtime role policy is declared in
`infra/pulumi/compute.ts`; applying that infrastructure is a separate deployment action.

The street field doubles as a free-form address search (street, postal code, district,
city, or partial address). Autocomplete is scoped to Brazil, limited to five results,
and debounced in the UI. Postal/locality results can leave the street and number
empty for manual completion.
Suggestions stay transient. Selecting a suggestion calls GetPlace with
`IntendedUse: Storage`, because confirmed address fields are persisted in PostgreSQL.
No place IDs or coordinates are persisted. Storage pricing applies to that details call.
See https://docs.aws.amazon.com/location/latest/developerguide/places-intended-use.html.

Manual entry and correction remain available when lookup is unavailable or has no
results. Address is optional in intake, is retained between steps, and is passed to
both new enrollment and resumed enrollment through the existing address commands.
No schema migration is required. Missing or partial historic addresses are tracked
in GitHub issue #222; completeness rules and queue priority remain undefined.

Validation: desktop and narrow browser flow, focus, manual input, back/forward draft
retention, unavailable search, and controlled autocomplete/details responses. Live
AWS autocomplete and stored address details were verified with the `lazuli` profile in
`us-east-2`. The local server must inherit `AWS_PROFILE=lazuli`.
