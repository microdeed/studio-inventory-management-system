# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-11-11

| Allow users to update their own PIN (code already written; needs integration/mapping to UI).                                |
| --------------------------------------------------------------------------------------------------------------------------- |
| Map *Purchase date* and *Condition* fields correctly to the database and frontend during imports.                           |
| Add a required “purpose” clause/field to checkout transactions for better tracking.                                         |
| Limit check-in items to equipment checked out by the current user (Only admins have no restrictions).                       |
| Run barcode generation on CSV import or equipment edits if the barcode field is null/empty; flag for relabeling if updated. |
| Use a default “00” year/date format if purchase date is unknown or null.                                                    |
| Implement automatic session expiration after 15 minutes of inactivity- after 30 minute guarantee.                           |
| Set default timezone to Central (configurable in settings).                                                                 |


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
