# Project memory

## Product intent & audience

- System for managing garage refueling transactions and invoicing.
- Primary actors: garages (service providers) and clients (vehicle owners/operators).
- Core flow: client refuels at a garage → invoice generated → emailed to client.
- Garage profiles store contact details including email address.
- Supports bulk import of garages from an Excel spreadsheet (e.g. TotalEnergies), mapping to the spreadsheet's column headings.

## Brand personality & voice

- Practical, consultative tone; confirms intent before implementing.

## Visual design & UX direction

- Global design instructions live in `.bolt/prompt` (beautiful, production-worthy, Tailwind + Lucide React, JSX).
- Implied UI pattern: garage list/table with a status indicator (e.g. "pending" badge) to distinguish unreviewed imported garages.

## Decisions, constraints & rationale

- Invoices are delivered as PDF attachments via email.
- Invoice sending supports configurable frequency settings; at least an "instant" option exists.
- Garage email addresses are stored in garage profiles; some may be missing.
- For spreadsheet import: names and contact details are populated; all other fields left blank.
- Imported garages are marked with status "pending" until reviewed.
- Default password "123456" assigned to every imported garage.
- No code changes made yet; pending the spreadsheet attachment and prior user decision on garage copy behavior.

## Open questions & assumptions

- TotalEnergies spreadsheet has not yet been attached to the project; import not run.
- Should the garage receive the full PDF invoice (same as client) or only a short notice?
- Should the garage copy apply to all frequencies or only the "instant" setting?
- Assumption: garages without an email address are skipped; client still receives their invoice.
- Awaiting user confirmation before implementing garage as second recipient.