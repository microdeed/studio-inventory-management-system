# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
