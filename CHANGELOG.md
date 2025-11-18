# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).



## [1.1.1] - 2025-11-18

# Patch Notes v1.1.1
**Release Date:** November 18, 2025  
**Purpose:** Preparation for Phase 3 implementation, focusing on QR code enhancements, settings improvements, printing functionality, and bug fixes to ensure smoother development progression. This patch builds on Version 2.0, addressing inconsistencies and adding foundational elements for upcoming features like advanced QR handling and reporting.
## New Features and Improvements
- **QR Code Refactoring for Reusability**:
  - Introduced a dedicated utility module (`backend/utils/qrGenerator.js`) for QR code generation, allowing it to be called from multiple routes and pages (e.g., equipment creation, import, and printing workflows).
  - This replaces inline QR generation in `import.js` and equipment routes, promoting code modularity and easier maintenance in Phase 3.
- **QR Code String Optimization**:
  - Updated QR code string generation in `backend/routes/import.js` and `backend/routes/equipment.js` to use a shortened format based on stripped barcode values (e.g., removing prefixes or unnecessary characters for compactness).
  - Ensures QR codes are more efficient for scanning and storage without losing essential data.
- **Settings Page Enhancements**:
  - Synchronized the version display on the Settings page (`frontend/src/pages/Settings.tsx`) to match the system-wide version (now dynamically pulled from `package.json` or a central config file).
  - Added additional system information to the Settings page, including:
    - Current database version and last migration date.
    - Active user count and role breakdown.
    - System uptime and last backup timestamp.
    - Environment details (e.g., NODE_ENV, port configurations).
  - These additions provide better administrative oversight and debugging tools.
- **Printing Functionality Skeleton**:
  - Added a basic print skeleton utility (`frontend/src/utils/printUtils.ts`) for generating printable views of equipment lists, barcodes, and QR codes.
  - Introduced a new Print UI component (`frontend/src/components/PrintModal.tsx`) accessible from the Equipment and Settings pages.
    - Supports selecting items for print (e.g., individual equipment or batches).
    - Includes options for barcode/QR inclusion, layout (e.g., labels or full sheets), and preview mode.
    - Integrated with browser print dialog for PDF export compatibility.
  - This lays the groundwork for Phase 3 expansions like custom label printing and report exports.
## Bug Fixes
- **Barcode Synchronization Issue**:
  - Resolved discrepancy between frontend barcode display/generation (`frontend/src/components/AddEquipmentModal.tsx` and Equipment page) and backend abbreviations (`backend/utils/barcodeGenerator.js`).
  - Frontend now fetches and displays barcodes using the exact backend-generated format, ensuring consistency across the system (e.g., aligning type codes like "CA" for Camera).
- **Search Pagination Bug**:
  - Fixed issue in Equipment page search functionality (`frontend/src/pages/Equipment.tsx`) where results were not displaying correctly when not on the first page of the registry.
  - Updated pagination logic to reset to page 1 on new searches and properly apply filters across all pages, preventing "no results" errors on subsequent pages.


## [1.1.0] - 2025-11-11

Version 1.1.0
Release Date: November 11, 2025
Focus: Polish existing features, improve data handling, and add basic security measures. This minor release refines core workflows, enhances import reliability, and introduces essential security enhancements to ensure smoother operations and better user control.

### New Features
Self-User PIN Change: Users can now update their own PIN directly through the UI. (Integrated existing code for seamless mapping.)
Checkout Purpose Field: Added a required "purpose" field to checkout transactions, enabling better tracking and auditability of equipment loans.
Restricted Check-in/Out: Check-in/out operations are now limited to equipment checked out by the current user. Admins retain full unrestricted access for oversight.
Auto-Barcode Generation on Edits/Imports: Barcode generation now automatically triggers during CSV imports or equipment edits if the barcode field is null or empty. Updated items are flagged for relabeling to maintain consistency.
Handle Unknown Purchase Dates: Implemented a default "00" year/date format (e.g., "2000-01-01") for cases where purchase date is unknown or null, ensuring data integrity without errors.
Session Timeout: Added automatic session expiration after 15 minutes of inactivity, with a 30-minute grace period for guaranteed access resumption.
Timezone Configuration: Set the default timezone to Central Time (US/Central), with options for configuration in the settings page.

### Improvements

CSV Import Enhancements: Improved mapping for "Purchase Date" and "Condition" fields during imports, ensuring accurate translation to database and frontend representations. This resolves previous inconsistencies and supports bulk operations more reliably.

### Security Enhancements

Strengthened user authentication flows with the new PIN change and session timeout features.
Role-based restrictions on check-in/out to prevent unauthorized actions.

### Dependencies and Technical Changes

Database Schema Updates: Added purpose field to the transactions table. Run the migration script (backend/database/migration_v3.sql) to apply changes.
Versioning System: Introduced an automated version management system:
Central version.json file as the single source of truth.
Auto-sync to all package.json files (root, backend, frontend).
New NPM scripts: npm run version:patch, npm run version:minor, npm run version:major for bumping versions.
Added /api/version endpoint for runtime version info.
Dynamic version display in the UI footer/dashboard.


### Bug Fixes

None reported in this release; focus was on proactive polishing.                                                                


## [1.0.0] - 2025-10-13

### Added
- Initial release of Studio Inventory Management System
- Equipment tracking with barcode/QR code support
- User management with PIN-based authentication
- Check-in/check-out transaction system
- Activity logging and audit trail
- CSV import functionality
- Category management with color coding
- Role-based access control (Admin, Manager, Staff)
- Docker-based deployment with multi-stage builds
- Automated CI/CD pipeline with Bitbucket

### Features
- SQLite database with migration system
- React frontend with TypeScript
- Express.js backend API
- Responsive UI with mobile support
- Real-time barcode generation
- Equipment status tracking
- Kit contents management
- Automated relabeling workflow
