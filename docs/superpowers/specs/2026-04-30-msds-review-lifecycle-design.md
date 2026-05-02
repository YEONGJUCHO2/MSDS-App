# MSDS Review Lifecycle Design

## Goal

Make the app match the field workflow: initial MSDS uploads are treated as reviewed, regulatory rechecks can lock a document into review-needed state, and only a new MSDS re-attachment can return that document to reviewed state.

## Decisions

- Initial upload creates a document with review state `approved`.
- Official API recheck that introduces a new internal-format regulatory hit changes the document review state to `needs_review`.
- A review-needed document stays review-needed until a replacement MSDS file is uploaded for that same document.
- There is no batch "mark reviewed" button.
- Replacement upload restores review state to `approved`, stores the new attachment, refreshes extracted text/components/regulatory matches, and removes red bold regulatory review highlighting for that document.
- Dashboard and MSDS pages use the same document list behavior: name search, uploaded date range, review-state filter, rename, attachment open, selection, delete, and recheck.
- Attachment controls show a paperclip icon. PDF files open inline where the browser supports it; office/spreadsheet/csv files still download.
- Site management exposes the same MSDS search and state filter. Opening a review-needed MSDS from a site shows: "해당 MSDS는 개정이 필요합니다. 현장 비치 필요시 보건담당자와 협의 바랍니다".

## Data Model

Add document-level review metadata:

- `review_state`: `approved` or `needs_review`
- `review_reason`: short machine-readable or user-facing reason
- `review_required_at`: ISO timestamp when review became required
- `review_completed_at`: ISO timestamp when replacement upload completed
- `last_regulatory_checked_at`: ISO timestamp from latest official recheck
- `replacement_uploaded_at`: ISO timestamp for latest replacement upload

Existing `review_queue` remains for component extraction quality issues. Document review state becomes the source of truth for whether an MSDS is usable without update.

## API Shape

- `GET /api/documents` returns the review metadata.
- `PATCH /api/documents/:documentId` renames a document.
- `POST /api/documents/:documentId/replacement` uploads a new MSDS file for that document and marks it approved after processing.
- `POST /api/documents/recheck` updates `last_regulatory_checked_at`; if official regulatory hits are found, it marks affected documents as `needs_review`.

## UI Behavior

- State labels are `검수 완료`, `검수 필요`, and `분석 필요` only when no components were extracted.
- Red bold regulatory cells appear only while the selected document review state is `needs_review`.
- Dashboard and MSDS list controls are aligned.
- Site management warns before opening review-needed attachments.

## Testing

- Repository tests cover migration defaults, recheck state transitions, rename, and replacement approval.
- UI tests cover filters, date range, paperclip attachment, full filename title, and site warning.
- Build and full test suite must pass before completion.
