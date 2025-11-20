# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.1] - 2025-11-18

### Patch Notes v1.1.1  
**Release Date:** November 18, 2025  
**Purpose:** Preparation for Phase 3 implementation, focusing on QR code enhancements, settings improvements, printing functionality, and bug fixes to ensure smoother development progression.

### New Features and Improvements

#### QR Code Refactoring for Reusability
- Introduced a dedicated utility module (`backend/utils/qrGenerator.js`) for QR code generation, allowing it to be used across multiple routes and pages.
- Replaced inline QR generation in `import.js` and equipment routes, improving modularity and maintainability for Phase 3.

#### QR Code String Optimization
- Updated QR code string generation in `backend/routes/import.js` and `backend/routes/equipment.js` to use a shortened format based on stripped barcode values.
- Ensures more efficient scanning and storage without losing essential data.

#### Settings Page Enhancements
- Version display in `frontend/src/pages/Settings.tsx` now synchronizes with the system-wide version, pulled dynamically from `package.json` or a central config.
- Added additional system information to the Settings page.

#### Printing Functionality Skeleton
- Added a basic print utility (`frontend/src/utils/printUtils.ts`) for generating printable views of equipment lists, barcodes, and QR codes.
- Introduced a new `PrintModal` component (`frontend/src/components/PrintModal.tsx`) accessible from the Equipment and Settings pages.

### Bug Fixes

#### Barcode Synchronization Issue
- Resolved discrepancies between frontend barcode display/generation (`AddEquipmentModal.tsx` and Equipment page) and backend abbreviations (`backend/utils/barcodeGenerator.js`).

#### Search Pagination Bug
- Fixed an issue in `frontend/src/pages/Equipment.tsx` where search results did not display correctly when not on the first page.
- Pagination now resets to page 1 on new searches and applies filters properly across all pages.

---

## [1.1.0] - 2025-11-11

### Release v1.1.0

**Version:** 1.1.0  
**Release Date:** November 11, 2025  
**Focus:** Polish existing features, improve data handling, and add basic security measures.

### New Features
- **Self-User PIN Change:** Users can now update their own PIN through the UI.
- **Checkout Purpose Field:** Added a required "purpose" field for checkout transactions to improve auditability.
- **Restricted Check-in/Out:** Users can only check in/out equipment they personally checked out. Admins retain full access.
- **Auto-Barcode Generation:** Now triggers automatically during CSV imports or edits if the barcode field is empty.
- **Handle Unknown Purchase Dates:** Defaults to `"2000-01-01"` when the purchase date is null/unknown.
- **Session Timeout:** Automatic expiration after 15 minutes of inactivity, with a 30-minute grace window.
- **Timezone Configuration:** Default timezone set to US/Central, configurable in settings.

### Improvements
- **CSV Import Enhancements:** Better mapping for “Purchase Date” and “Condition” fields.

### Security Enhancements
- Strengthened user authentication.
- Role-based restrictions on check-in/out to prevent unauthorized actions.

### Dependencies and Technical Changes
- **Database Update:** Added `purpose` field to transactions (`backend/database/migration_v3.sql`).
- **Versioning System:**
  - Added `version.json` as the single source of truth.
  - Auto-sync to all `package.json` files.
  - New NPM scripts: `version:patch`, `version:minor`, `version:major`.
  - New `/api/version` endpoint.
  - Dynamic version display in UI.

### Bug Fixes
- None reported; release focused on polishing.

---

## [1.0.0] - 2025-10-13

### Added
- Initial release of Studio Inventory Management System.
- Equipment tracking with barcode/QR code support.
- User management with PIN-based authentication.
- Check-in/check-out transaction system.
- Activity logging and audit trail.
- CSV import functionality.
- Category management with color coding.
- Role-based access control (Admin, Manager, Staff).
- Docker-based deployment with multi-stage builds.
- Automated CI/CD pipeline with Bitbucket.

### Features
- SQLite database with migration system.
- React frontend with TypeScript.
- Express.js backend API.
- Responsive UI with mobile support.
- Real-time barcode generation.
- Equipment status tracking.
- Kit contents management.
- Automated relabeling workflow.
