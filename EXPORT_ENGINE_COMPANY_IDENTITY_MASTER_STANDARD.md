# ZAMORIN CAFÉ ERP
# COMPANY / ORGANISATION IDENTITY MASTER — EXPORT BRANDING ADDENDUM

### Extends: UNIVERSAL EXPORT & REPORT INTEGRITY ENGINE (Sections 1–363)
### LOGO · LEGAL & BRAND IDENTITY · GST · FSSAI · CONTACT · GATED EDIT ACCESS

This document continues directly from Section 363 of the Universal Export &
Report Integrity Engine specification. It defines the Company / Organisation
Identity Master: the single source of company branding and statutory
identity (logo, legal name, address, GST, FSSAI, contact) that every PDF,
XLSX, and CSV export must resolve from — plus a deliberately locked-down
edit path for keeping that information current.

=====================================================================
364. PURPOSE
=====================================================================

Every export produced by the Universal Export Engine (PDF, XLSX, CSV, and
packages) must carry authoritative, verifiable business identity:

logo
legal name
brand name
registered address
GST number(s)
FSSAI number(s)
contact details

This addendum defines ONE canonical COMPANY / ORGANISATION IDENTITY MASTER
that every export format reads from — the same "single canonical source"
principle already established for report data in Section 0.

Do NOT hardcode company details inside individual PDF/XLSX/CSV templates.
Every renderer resolves identity from this master at generation time.

=====================================================================
365. RELATIONSHIP TO EXISTING SECTIONS
=====================================================================

This addendum extends, and must stay consistent with, work already defined
in:

Section 40-42   — Universal PDF Corporate Template, footer, watermark
Section 51      — XLSX Report Info Sheet
Section 65-66   — CSV Package, Universal Manifest
Section 161     — Template Branding
Section 197-199 — Identifiers must not be treated as numbers; Excel precision
Section 223-224 — Renderer network isolation, Report Asset Policy
Section 319     — Printed-report support contact sourced from configuration

Do not create a second, competing branding system.

Where this addendum gives a field list or rule more specific than the
sections above, the more specific rule here governs.

=====================================================================
366. MANDATORY COMPANY IDENTITY FIELDS  ◄ USER-REQUESTED FIELD SET
=====================================================================

Every export, in every format, must be able to resolve the following fields
from the Company / Organisation Identity Master:

IDENTITY
  Logo (primary + print-safe monochrome variant)
  Legal Business Name
  Trade / Brand Name (e.g. "Zamorin Café")

LOCATION
  Registered / Head Office Address (line 1, line 2, city, state, PIN, country)
  Outlet-level address where the report is scoped to one café (Section 368)

STATUTORY
  GSTIN (Section 369 — may be more than one, state-wise)
  FSSAI License Number (Section 370 — per outlet)

CONTACT
  Primary phone
  Primary email
  Website (if configured)

These are exactly the fields you asked for: logo, name, address/location,
GST number, FSSAI number, and contact details. Section 367 lists further
fields worth adding on top of this minimum set.

=====================================================================
367. EXTENDED IDENTITY FIELDS (RECOMMENDED)
=====================================================================

Beyond the mandatory set in Section 366, the Master should also carry:

STATUTORY / REGISTRATION
  PAN
  CIN / LLPIN (if incorporated)
  Udyam / MSME Registration Number (if applicable)
  Trade License / Shop & Establishment Number
  Any additional licence relevant to a food & beverage business (e.g.
  liquor licence, weights & measures certificate) — model as an
  extensible list, not fixed fields, since not every outlet holds every
  licence

IDENTITY / PRESENTATION
  Tagline
  Authorised Signatory (name, designation) — for CERTIFIED/official documents
  Support helpline (if different from primary phone)
  Support email (if different from primary email)
  WhatsApp Business number (optional)

FINANCIAL CONTEXT
  Default currency (cross-reference existing currency handling)
  Financial year start month

BANKING (Section 389 — CONFIDENTIAL, opt-in per report only)
  Account name, bank name, masked account number, IFSC — for Tax
  Invoice / Statement report types that require settlement instructions

Do not treat this list as final. Add fields the actual ERP already tracks
for the organisation rather than inventing new ones, consistent with the
"use actual code/model support" principle in Section 11.

=====================================================================
368. TWO-TIER MODEL — ORGANISATION VS OUTLET (CAFÉ)
=====================================================================

Indian statutory registration is not always organisation-wide:

GST registration is STATE-wise. An organisation operating cafés in more
than one state typically holds a separate GSTIN per state.

FSSAI registration is PREMISES-wise. Each physical outlet normally holds
its own FSSAI licence.

Model identity in two tiers:

ORGANISATION PROFILE (one per tenant)
  legal name, brand name, logo, PAN, CIN, head-office address,
  primary contact, primary/default GSTIN

OUTLET COMPLIANCE PROFILE (one per café — extend the EXISTING Café/outlet
entity; do not create a duplicate entity per Section 130)
  outlet address, outlet FSSAI number + validity, outlet GSTIN (where it
  differs from the organisation default), outlet phone

RESOLUTION RULE:

Report scoped to ONE café → use that outlet's address/FSSAI/GSTIN, with
organisation-level logo/brand name.

Report scoped to the FULL organisation → use head-office/registered
details; for compliance packs, optionally list every outlet's FSSAI number
in an appendix (Section 250 — Report Provenance Drill-Down is a natural
place for this).

If Zamorin currently operates a single outlet, Organisation Profile and
Outlet Compliance Profile may collapse into one record — keep the two-tier
schema so a second outlet does not require a redesign later.

=====================================================================
369. STATE-WISE GSTIN HANDLING
=====================================================================

Store GSTIN as a list, not a single field:

```
gstin: [
  { state, stateCode, number, isPrimary }
]
```

Report resolution:

Report scoped to a café in State X → show the GSTIN registered for State X,
if one exists; otherwise fall back to the organisation's primary GSTIN and
record that fallback occurred (do not silently mismatch state and GSTIN on
a document that may be used for tax purposes).

Validate structurally: 15 characters, opening with the 2-digit state code
that matches the outlet's own state code, followed by the entity PAN.
Treat the full value as TEXT, never as a number (Section 197-199).

Confirm current GSTIN validation rules against the latest GST authority
specification before hard-coding a checksum algorithm — the structural
format is stable, but this document is not the authoritative source for
checksum computation.

=====================================================================
370. FSSAI LICENSING & VALIDITY TRACKING
=====================================================================

Store per outlet:

```
fssai: { number, licenseType, validFrom, validTill }
```

licenseType is informational (e.g. Basic / State / Central) — do not gate
export behaviour on it.

Number is a 14-digit identifier. Treat as TEXT (Section 197-199); never
strip leading zeros, never cast to a number, never render in scientific
notation in XLSX.

validTill drives Section 388 (compliance expiry monitoring). It does NOT
block export generation — Primary Master/Owner export authority is never
gated by a licence-expiry state (consistent with Section 126: technical/
compliance signals are not business/policy export restrictions).

=====================================================================
371. LOGO ASSET HANDLING & FALLBACK
=====================================================================

Store at minimum two renditions:

primary    — full colour, for screen PDF / XLSX Report Info sheet
monochrome — print-safe single-colour variant for watermark use and for
             black-and-white printing (Section 92, Section 162 already
             require classification labels to remain legible in black and
             white; the logo should follow the same rule)

Ingest the logo through the application's own asset pipeline before use.
Do not let any renderer fetch a user-supplied logo URL live at generation
time — this is the exact case Section 224 already warns about ("If
organisation logo URL is configurable: validate and securely ingest/store
it before report generation").

Fallback: if no logo is configured, render a clean text wordmark (brand
name in the template's heading style) instead of a broken image icon or
empty space.

Minimum resolution should be high enough not to look pixellated at A4
print size — validate on ingest, not at render time.

=====================================================================
372. PLACEMENT — PDF HEADER (WITH LAYOUT REFERENCE)
=====================================================================

First-page layout, conceptually:

```
+------------------------------------------------------------+
| [LOGO]   Zamorin Café                          +---------+ |
|          Zamorin Hospitality Pvt Ltd            |         | |
|          Address line 1, City, State - PIN      |   QR    | |
|          GSTIN: ..............  FSSAI: ........ | (top-   | |
|          Phone · Email · Website                |  right) | |
|                                                  +---------+ |
|--------------------------------------------------------------|
|  REPORT TITLE                Report Code · Version · Class.  |
|--------------------------------------------------------------|
|                                                                |
|                      [ report body / table ]                  |
|                                                                |
|--------------------------------------------------------------|
| Zamorin Café · GSTIN ... · FSSAI ...                          |
| ZMR-PAY-202608-... · V2 · RESTRICTED                          |
| Generated 24-Aug-2026 17:32 IST · Page 4 of 17                |
+------------------------------------------------------------+
```

Logo — top-left.
Legal name (or brand name, per template configuration) — beside/below logo.
Registered/outlet address, GSTIN, FSSAI, phone/email — small block beneath
the name.

QR code remains TOP-RIGHT per Section 25 — the identity block must not
crowd or resize the QR's reserved zone.

Subsequent pages: identity block may reduce to a single compact line
(brand name + GSTIN or FSSAI) to preserve room for data — see Section 376
for the full presentation-weight rule.

=====================================================================
373. PLACEMENT — PDF FOOTER
=====================================================================

Extend the mandatory footer already defined in Section 41. Do not replace
it — add a brand identity line above or alongside it.

Example:

```
Zamorin Café · GSTIN 32XXXXX1234X1Z5 · FSSAI 12345678901234
ZMR-PAY-202608-... · V2 · RESTRICTED
Generated 24-Aug-2026 17:32 IST · Page 4 of 17
```

Report Code must still appear on every page per Section 41/163. The added
identity line must not push the footer into an unreadable size — reduce to
brand name + one statutory number if space is tight; keep the full detail
on the XLSX Report Info sheet regardless.

=====================================================================
374. PLACEMENT — XLSX REPORT INFO SHEET
=====================================================================

Add to the Report Info sheet fields already listed in Section 51:

Company Legal Name
Brand Name
Registered / Outlet Address
GSTIN(s)
FSSAI Number(s)
Contact (phone, email, website)

All as TEXT cells (Section 198-199). Optionally include the QR verification
image on this sheet as already permitted by Section 51 — the PDF QR remains
the mandatory one.

=====================================================================
375. PLACEMENT — CSV / CSV PACKAGE
=====================================================================

Never place identity rows inside the canonical machine data file — this
would break the "one record per row, one field per column" rule (Section
53/61) and contaminate the interchange data.

For a CSV Package (Section 65): include company identity in
report-info.csv / manifest.json, exactly where Report Code and Report
metadata already live.

For a single flat CSV export (not a package): still generate a companion
report-info.csv (or fold identity into the existing manifest attached to
the Export Record) rather than adding banner rows to the data file. The
data file stays 100% clean for machine consumption; identity is one
Export Record / manifest lookup away.

=====================================================================
376. IDENTITY PRESENTATION WEIGHT (RECOMMENDATION — ADJUSTABLE)
=====================================================================

Company identity METADATA is present on every export, in every format,
without exception — this satisfies the requirement directly.

VISUAL weight is a separate, configurable choice per Report Definition:

FULL LETTERHEAD — logo + full address/GST/FSSAI/contact block, typically
for CERTIFIED, customer-facing, or statutory reports (invoices, statements,
audit packs).

COMPACT STRIP — small logo + brand name + one statutory number, for
high-frequency internal operational reports where a full block on every
page would crowd the data (e.g. a quick stock count).

This distinction is a recommendation, not a requirement — set every report
to FULL LETTERHEAD if strict visual uniformity matters more than page
density. Either way, the underlying identity data is always resolvable
from the Master and always present in the manifest/Report Info sheet.

=====================================================================
377. COMPANY DETAILS MASTER — DATA MODEL
=====================================================================

Conceptually:

```
COMPANY_DETAILS_MASTER = {
  organisationId,
  legalName,
  brandName,
  tagline,
  logo: { primaryUrl, monochromeUrl, ingestedAt },
  pan,
  cin,
  udyamNumber,
  registeredAddress: { line1, line2, city, state, stateCode, pincode, country },
  gstin: [ { state, stateCode, number, isPrimary } ],
  licences: [ { type, number, validFrom, validTill } ],
  contact: { phone, supportPhone, email, supportEmail, website, whatsapp },
  banking: {            // OPTIONAL — CONFIDENTIAL, Section 389
    accountName, bankName, accountNumberMasked, ifsc
  },
  authorisedSignatory: { name, designation },
  financialYearStartMonth,
  defaultCurrency,

  version,               // Section 378
  status,                // CURRENT | SUPERSEDED
  effectiveFrom,
  createdBy,
  changeReason
}

OUTLET_COMPLIANCE_PROFILE = {
  outletId,              // = existing Café entity — do not duplicate
  address: { line1, line2, city, state, stateCode, pincode },
  fssai: { number, licenseType, validFrom, validTill },
  gstin,                 // only if it differs from organisation default
  phone
}
```

Reuse the existing Café/outlet entity for OUTLET_COMPLIANCE_PROFILE fields
rather than creating a parallel model, per Section 130.

=====================================================================
378. VERSIONING OF COMPANY DETAILS
=====================================================================

Apply the SAME versioning discipline already defined for reports
(Section 17-18, 94) to the Company Details Master itself:

Every edit creates a NEW VERSION. The previous version is marked
SUPERSEDED, never overwritten, never deleted.

Store: Version, Effective From, Created By, Change Reason, Supersedes,
Superseded By — the identical shape already used for report versions.

This matters for a reason specific to company identity: a GSTIN, FSSAI
number, or registered address is a fact-in-time. If it changes, historical
documents must still show what was true when they were generated.

=====================================================================
379. SNAPSHOT BINDING ON EVERY EXPORT
=====================================================================

Every Export Record stores the Company Details Master version that was
CURRENT at generation time:

companyDetailsVersionId

This is the same "Data As Of" discipline already required for report data
(Section 68-69), applied to identity data. A report generated in June must
keep showing June's registered address and June's GSTIN even after the
Master is updated in August.

Do not resolve company identity dynamically at download time for an
existing artifact — resolve it once, at generation time, and freeze it
into that artifact and its manifest.

=====================================================================
380. INTERACTION WITH RE-DOWNLOAD / REGENERATE
=====================================================================

Consistent with Section 192:

RE-DOWNLOAD ORIGINAL — returns the stored artifact with its ORIGINAL bound
company-details snapshot, unchanged, even if the Master has since moved to
a newer version.

GENERATE CURRENT DATA — creates a new report/version and binds it to
whichever Company Details Master version is CURRENT at that new generation
time.

Do not let a company-details edit silently alter an already-generated
artifact. Do not let "Re-download Original" pick up the new address/GSTIN.

=====================================================================
381. EDIT ACCESS — LOCKED BY DEFAULT  ◄ USER-REQUESTED GATING
=====================================================================

Company Details are READ-ONLY everywhere in the application by default.

There is NO "Edit" control on any general settings page, dashboard, or
Export Centre screen.

The only entry point is a single, deliberately non-prominent control under
Administration & Governance:

  Organisation Identity (Restricted)

which, by default, opens in a read-only view — fields visible, nothing
editable — with a single small "Unlock to Edit" affordance rather than an
inline-editable form.

This is a rarely-used, high-consequence action, not a routine settings
screen. It should not appear in daily navigation.

=====================================================================
382. EDIT ACCESS — WHO CAN UNLOCK
=====================================================================

Recommended default, matching the Primary Master / Owner pairing already
used for every other high-trust action in this programme (Section 5):

Primary Master — can unlock and edit
Owner          — can unlock and edit

Enforce backend-authoritative, not frontend-hidden (Section 5's own rule
applies here too).

If your governance model wants this narrower — Primary Master only, for
example, since legal/statutory identity is arguably more sensitive than a
business-data export — that is a one-line permission change from this
default. State the decision explicitly in
docs/EXPORT_ENGINE_PERMISSION_MATRIX.md rather than leaving it implicit.

=====================================================================
383. EDIT ACCESS — UNLOCK FLOW
=====================================================================

"Unlock to Edit" must not silently flip the screen into an editable form.

Require an explicit interstitial:

  "You are about to edit officially registered business details. These
  appear on every export going forward, including certified and statutory
  documents. Continue?"

  [ Cancel ]   [ Continue to Edit ]

Only after confirmation do fields become editable. On leaving the screen
(navigation away, timeout, explicit Cancel) without saving, return to the
locked read-only state — do not leave an editable form open indefinitely.

=====================================================================
384. TIERED CONFIRMATION — STATUTORY VS CONTACT FIELDS (RECOMMENDATION)
=====================================================================

Not every field carries the same consequence. Consider two tiers:

STATUTORY / IDENTITY (higher consequence)
  Legal Name, GSTIN, FSSAI Number, PAN, CIN, Registered Address

CONTACT / MINOR (lower consequence)
  Phone, Email, Website, Tagline, WhatsApp number

For the statutory tier, require a stronger confirmation step before saving
— e.g. re-entering the current password, or a typed confirmation phrase —
mirroring the step-up-confirmation spirit already used elsewhere in this
programme for irreversible or high-impact actions (Section 152-153's
session/device model is the closest existing analogue).

For the contact tier, the standard unlock-and-save flow (Section 383) is
enough — no need to make a phone-number correction as heavy as a GSTIN
change.

This is a recommendation, not a requirement — a single confirmation tier
for the whole form is a reasonable simplification if the extra step isn't
wanted.

=====================================================================
385. AUDIT ON EVERY EDIT
=====================================================================

Every Company Details edit is an audited event, using the existing
immutable audit service (Section 114), recording:

Who, When, Which fields changed (old value → new value for changed fields
only), Change Reason, New Version ID.

Treat this with the same seriousness as Report Revocation (Section 95) —
it is exactly that kind of event: rare, consequential, and something a
future audit will want to see explained.

=====================================================================
386. VALIDATION RULES
=====================================================================

Validate structurally at entry time, not only at render time:

GSTIN  — 15 characters; opens with a 2-digit state code; contains the
         entity's 10-character PAN; structurally alphanumeric.
FSSAI  — 14-digit numeric licence number.
PAN    — 10 characters: 5 letters, 4 digits, 1 letter.
Email  — standard email format.
Phone  — matches the organisation's configured country/format.

These are structural checks to catch obvious entry errors — not a
substitute for verifying the number is genuinely registered. Confirm exact
current rules (particularly any checksum logic) against the latest
official specification before hard-coding validation; the field lengths
above are stable, but this document is not the authoritative source for a
checksum algorithm.

=====================================================================
387. IDENTIFIER TEXT-SAFETY
=====================================================================

GSTIN, FSSAI Number, PAN, and CIN are identifiers, not numbers — the exact
principle already established in Section 197-199.

Never auto-cast them to a numeric type.
Never let XLSX generation render them in scientific notation.
Never strip a leading zero.

Store and render every one of them as an explicit TEXT/string cell type in
XLSX, and as an unambiguously-typed string field in CSV.

=====================================================================
388. COMPLIANCE EXPIRY MONITORING (RECOMMENDATION)
=====================================================================

An expired FSSAI licence printed on an official document is a real
compliance exposure for a food business.

Track fssai.validTill per outlet and surface a warning — not a block — to
Primary Master/Owner:

  "FSSAI licence for [Outlet] expires in 15 days."

This fits naturally into the Export Operations Health surface already
defined in Section 117, alongside queue age and failure counts.

Do not block export generation on an expired licence — Primary Master/Owner
export authority is not conditional (Section 126). Whether an expired
licence number should be visually annotated on the exported document itself
("RENEWAL PENDING") is a business/legal decision for the organisation to
make explicitly, not something to default into the template silently.

=====================================================================
389. SENSITIVE FIELDS WITHIN COMPANY DETAILS
=====================================================================

If banking details are stored on the Master for settlement instructions on
invoices/statements, tag them with the BANKING_DATA sensitivity flag that
already exists in this programme's classification model (Section 22).

Banking fields must NOT appear on every export merely because they exist on
the Master. They are opt-in per Report Definition — only report types that
genuinely need settlement instructions (e.g. Tax Invoice, Customer
Statement) should resolve and render them.

A Payroll Register, an Inventory Stock Report, or any other report that has
no reason to carry the organisation's own bank account details should never
render this block, regardless of who is downloading it.

=====================================================================
390. RENDERER SECURITY FOR IDENTITY ASSETS
=====================================================================

Cross-reference: Section 223-224.

The logo (and any other identity asset embedded in a template) must be
served from the application's own trusted asset store at render time, never
fetched live from an external or user-editable URL by the PDF renderer.
This closes the exact SSRF-adjacent path Section 223-224 already warns
about, applied specifically to the identity block introduced here.

=====================================================================
391. BLACK-AND-WHITE / LOW-INK LEGIBILITY
=====================================================================

The identity block, like the classification watermark (Section 92) and the
general print-quality requirement (Section 162), must remain fully legible
in black-and-white printing:

Company name and statutory numbers as real text, not embedded only inside
a colour logo graphic.
Sufficient contrast for the monochrome logo variant (Section 371).
Do not rely on colour alone to distinguish any part of the identity block.

=====================================================================
392. REGIONAL-LANGUAGE NAME VARIANT (OPTIONAL)
=====================================================================

If the ERP renders reports or receipts in a regional language (Section 105
already lists Hindi, Malayalam, Tamil as tested scripts), consider an
optional secondary business-name field per language:

```
names: [ { language, value } ]
```

This is optional and only worth building once a specific report/receipt
type actually needs a non-English business name — do not add it
speculatively ahead of an actual requirement.

=====================================================================
393. API SURFACE (CONCEPTUAL)
=====================================================================

Consistent with the REST conventions already used in Section 131:

```
GET   /organisation/details              current version, for renderers
GET   /organisation/details/versions     version history
PATCH /organisation/details              Primary Master/Owner gated;
                                          creates a new version
GET   /outlets/:id/compliance-details
PATCH /outlets/:id/compliance-details    gated, per outlet
```

Do not use these exact paths if the current canonical API conventions
differ — match whatever pattern the rest of the ERP already follows.

=====================================================================
394. AUDIT SCRIPT
=====================================================================

Create:

scripts/audit_export_company_identity.mjs

Verify, across representative PDF/XLSX/CSV exports:

Logo, legal name, brand name, address, GSTIN, FSSAI number, and contact
all present and correctly resolved.
Outlet-scoped reports show the correct outlet's address/FSSAI/GSTIN.
Every export's manifest records the correct companyDetailsVersionId.
No live/remote asset fetch occurs during rendering.
GSTIN/FSSAI/PAN render as TEXT in XLSX, never numeric or scientific
notation.
Identity block remains legible when rendered in black-and-white.
Edit endpoint is unreachable without Primary Master/Owner authority, and
every edit produces a new version plus an audit entry.

=====================================================================
395. FINAL REPORT EXTENSION
=====================================================================

Append to the Final Report Format already defined in Section 189/362:

```
### Company / Organisation Identity
Logo:
Legal Name:
Brand Name:
Registered Address:
GSTIN(s):
FSSAI No(s):
Contact:
Outlet-Level Resolution:
Snapshot Versioning:
Edit Access Gate (default-locked):
Audit on Edit:
B/W Legibility:
Result:
```

=====================================================================
396. SCOPE BOUNDARY FOR THIS ADDENDUM
=====================================================================

This addendum defines the Company / Organisation Identity Master only.

It does NOT:

redesign the Report Definition Registry;
change classification, versioning, or audit architecture already defined
in Sections 1-363 beyond applying the same patterns to company identity;
introduce new export formats;
broaden Primary Master/Owner authority beyond identity-edit gating;
start Passbook;
start Login Module integration;
redesign Employee/Staff;
deploy production;
create a release tag.

Implement and test using the same evidence standard as the rest of this
programme — VERIFIED / TARGET / NOT CLAIMED — and return the Section 395
block filled in for review.

STOP. WAIT FOR USER / REVIEW before extending further.
