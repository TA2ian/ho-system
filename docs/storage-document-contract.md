# HO Network — Document Storage Contract

## Purpose

Customer documents are a Customer 360 capability, but the current foundation has no file-storage provider, upload service, object-access service, or storage-specific configuration.

This document defines the minimum server-side contract that must exist before customer document metadata or upload endpoints are exposed.

## Current state

- PostgreSQL is the current persistence layer.
- The API has no storage SDK dependency.
- Firebase is configured for Hosting only.
- No browser-to-storage upload contract exists.
- No signed download URL contract exists.
- No document malware/content validation pipeline exists.

Therefore the customer domain must not expose document upload/download behavior yet.

## Ownership and authority

The API remains authoritative for:
- customer ownership
- document metadata
- document lifecycle/status
- authorization
- upload intent creation
- completion/finalization
- download authorization
- audit events

The browser must never be trusted to choose an arbitrary object path or bypass document ownership.

## Required document lifecycle

The storage capability should use an explicit lifecycle rather than treating an uploaded object as automatically valid:

1. pending — upload intent created; object is not yet accepted as a customer document.
2. uploaded — bytes reached the storage boundary but server validation is not complete.
3. available — server validation succeeded and the document may be read by authorized users.
4. rejected — validation failed; the object must not be served as an accepted document.
5. deleted — logical document record is retained for audit/history while access is revoked.

A failed or abandoned upload must not leave an accessible customer document.

## Storage abstraction

The application should depend on a provider-neutral storage interface rather than importing a cloud-storage SDK into customer services.

Conceptual operations:

- createUploadIntent(owner/customer, metadata) -> server-generated object reference and constrained upload instructions
- finalizeUpload(documentId, observed object metadata) -> validated document
- createAuthorizedDownload(documentId, principal) -> short-lived access mechanism
- revoke(documentId) -> prevent future access
- deleteObject(documentId) -> provider operation after authorization and retention policy

The concrete provider is an infrastructure decision and must not change the customer domain contract.

## Object naming

Object keys must be generated server-side.

A key must be:
- non-guessable
- scoped to the document identifier
- independent of the original filename
- free of user-controlled path traversal components
- unsuitable for direct public access

The original filename is metadata only.

## Metadata requirements

The eventual document metadata resource should include at minimum:

- documentId
- customerId
- documentType
- title/display name
- originalFilename
- mediaType
- sizeBytes
- checksum/digest when available
- storageProvider
- storageObjectReference
- lifecycle/status
- uploadedBy
- createdAt
- updatedAt

The raw object bytes must not be stored in the customer row.

## Upload security

Before a document becomes available, the server must enforce:
- authenticated principal
- customers.write or a later dedicated document-write permission
- customer existence and ownership
- allowed document types
- MIME/type validation based on content where feasible, not filename alone
- maximum size
- checksum/integrity validation
- storage-side private access
- audit event
- idempotent finalization
- protection against object-reference substitution

If malware scanning is introduced, available must require a successful scan according to the configured policy.

## Download security

Downloads must never expose a permanent public object URL.

The API must:
1. authenticate the principal;
2. authorize access to the customer/document;
3. verify document lifecycle is available;
4. issue a short-lived access mechanism or stream through an authorized server boundary;
5. record consequential access where the audit policy requires it.

A frontend route guard is not sufficient.

## API shape

The first reviewed API should be split into explicit operations:

- POST /api/v1/customers/:customerId/documents/upload-intents
- POST /api/v1/customer-documents/:documentId/finalize
- GET /api/v1/customers/:customerId/documents
- GET /api/v1/customer-documents/:documentId
- POST /api/v1/customer-documents/:documentId/download
- POST /api/v1/customer-documents/:documentId/revoke

All mutations follow the existing authenticated, permission, validation, idempotency, transaction and audit contract.

The exact response envelope and error codes must be added to OpenAPI and docs/api-contract.md together with implementation.

## Permission boundary

The existing customers.read / customers.write permissions are sufficient for the initial design only if the organization accepts that every principal holding those permissions may access customer documents.

If documents can contain restricted financial, identity, legal, or personally sensitive material, a dedicated permission such as customer_documents.read / customer_documents.write should be introduced before exposure.

The backend must not infer access from UI visibility.

## Retention and deletion

Logical deletion and physical object deletion are separate concerns.

The database record should preserve enough metadata for audit and reconciliation. Physical deletion must follow the retention policy and must not silently erase required financial/audit evidence.

## Non-goals

This document does not select Firebase Storage, S3, GCS, or another provider.

It does not add document tables, upload endpoints, download endpoints, or frontend document UI.

Those implementation steps are blocked until the storage provider, credentials/configuration model, private-access mechanism, retention policy, and validation/scanning policy are reviewed.
