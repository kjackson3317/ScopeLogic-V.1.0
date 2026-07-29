# ScopeLogic v1.0 RC2.2

## TypeScript Blob compatibility correction

- Added `pdfBytesToBlob()` to copy `pdf-lib` output into a definite `ArrayBuffer`.
- Updated individual PDF preview/download generation to use the compatibility helper.
- Updated official release package generation to use the compatibility helper.
- No application workflow, database, authentication, PDF-layout, or stored-data changes.
