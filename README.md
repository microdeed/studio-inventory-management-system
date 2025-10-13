# Studio Equipment Inventory System

A comprehensive equipment management system designed for studios with a traditional ledger-style interface that's fully responsive for mobile devices.

## Features

### Core Functionality
- **Equipment Management**: Add, edit, delete, and track all studio equipment
- **Check-in/Check-out**: Simple workflow for equipment loans with transaction history
- **User Management**: Manage staff and their equipment access permissions
- **Real-time Status**: See equipment availability at a glance
- **Search & Filtering**: Find equipment quickly by name, serial number, category, or status

### Advanced Features
- **Ledger-style UI**: Traditional book-keeping appearance with modern functionality
- **Mobile Responsive**: Optimized for tablets and mobile devices
- **CSV Import**: Bulk import equipment data from spreadsheets
- **Category Management**: Organize equipment by type with customizable color coding
- **Maintenance Records**: Track equipment maintenance, repairs, and service history
- **Analytics & Reports**: Dashboard statistics, utilization reports, and overdue tracking
- **Transaction History**: Complete audit trail of all equipment movements

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### 1. Install Dependencies
```bash
cd inventory
npm run install-all
```
This installs dependencies for both the backend and frontend.

### 2. Start the Application
```bash
npm run dev
```
This will start both:
- Backend server on port 5000
- Frontend development server on port 3000

### 3. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/api/health

### Troubleshooting
If ports are already in use, you can modify them in:
- Backend: `backend/server.js`
- Frontend: `.env` file (create if needed)

## Project Structure

```
inventory/
├── backend/              # Node.js/Express API server
│   ├── database/        # SQLite database and connection
│   ├── models/          # Data models
│   ├── routes/          # API route handlers
│   │   ├── equipment.js
│   │   ├── transactions.js
│   │   ├── users.js
│   │   ├── categories.js
│   │   ├── maintenance.js
│   │   ├── reports.js
│   │   └── import.js
│   ├── scripts/         # Utility scripts
│   ├── uploads/         # File upload directory
│   └── server.js        # Main server file
├── frontend/            # React/TypeScript UI
│   ├── public/
│   └── src/
│       ├── components/  # Reusable components
│       ├── pages/       # Main page components
│       │   ├── Dashboard.tsx
│       │   ├── Equipment.tsx
│       │   ├── CheckInOut.tsx
│       │   ├── Users.tsx
│       │   ├── Reports.tsx
│       │   └── Settings.tsx
│       ├── hooks/       # Custom React hooks
│       └── styles/      # CSS stylesheets
├── data/                # Data import/export folder
└── package.json         # Root package manager

```

## Importing Equipment Data

### CSV Import (Recommended)
1. Navigate to Settings page in the web interface
2. Click "Import Data" or "Upload CSV"
3. Download the CSV template if needed
4. Fill in your equipment data
5. Upload the completed CSV file

### CSV Format
Required and optional columns:
- `name` - Equipment name (required)
- `serial_number` - Unique serial number
- `model` - Model number
- `manufacturer` - Brand/manufacturer
- `category` - Equipment category
- `condition` - excellent/good/fair/poor/damaged
- `location` - Storage location
- `purchase_date` - Purchase date (YYYY-MM-DD)
- `purchase_price` - Original cost (numeric)
- `current_value` - Current value (numeric)
- `description` - Additional details
- `notes` - Internal notes

### API Import
Use the import endpoint directly:
```bash
POST /api/import/equipment
Content-Type: multipart/form-data
```

## Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite3 (file-based, zero configuration)
- **File Upload**: Multer
- **API**: RESTful architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Custom CSS (ledger-inspired design)
- **HTTP Client**: Fetch API
- **Routing**: React Router
- **Icons**: Lucide React
- **Design**: Mobile-first responsive layout

## API Endpoints

### Equipment Routes
- `GET /api/equipment` - List all equipment with optional filters
- `GET /api/equipment/:id` - Get specific equipment details
- `POST /api/equipment` - Create new equipment entry
- `PUT /api/equipment/:id` - Update equipment details
- `DELETE /api/equipment/:id` - Delete equipment

### Transaction Routes
- `GET /api/transactions` - List all transactions
- `POST /api/transactions/checkout` - Check out equipment to user
- `POST /api/transactions/checkin` - Check in equipment
- `GET /api/transactions/overdue` - Get overdue items

### User Routes
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user details
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Category Routes
- `GET /api/categories` - List all categories
- `POST /api/categories` - Create new category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Maintenance Routes
- `GET /api/maintenance` - List maintenance records
- `POST /api/maintenance` - Create maintenance record
- `PUT /api/maintenance/:id` - Update maintenance record

### Import Routes
- `POST /api/import/equipment` - Import equipment from CSV
- `GET /api/import/template` - Download CSV template

### Report Routes
- `GET /api/reports/dashboard` - Dashboard statistics
- `GET /api/reports/utilization` - Equipment utilization report
- `GET /api/reports/overdue` - Overdue equipment report

## User Interface

### Pages
- **Dashboard**: Overview statistics, recent activity, and quick actions
- **Equipment**: Full equipment list with search, filter, and CRUD operations
- **Check In/Out**: Quick transaction interface for borrowing/returning equipment
- **Users**: Manage system users and staff
- **Reports**: Analytics, utilization reports, and overdue tracking
- **Settings**: System configuration and data import

### Design Features
- **Ledger-style UI**: Traditional book-keeping inspired design
- **Responsive Layout**: Optimized for desktop, tablet, and mobile
- **Color-coded Categories**: Visual organization of equipment types
- **Real-time Updates**: Instant status changes and availability
- **Touch-friendly**: Large tap targets for mobile use

## Database Schema

The SQLite database includes these tables:
- `equipment` - Equipment inventory with details
- `users` - System users and staff
- `categories` - Equipment categories with colors
- `transactions` - Check-in/out history and current status
- `maintenance_records` - Maintenance and repair history
- `damage_reports` - Damage incident tracking (if applicable)

Database file location: `backend/database/inventory.db`

## Customization

### Adding Categories
1. Navigate to Settings or use the Categories API
2. Create categories with custom names and hex color codes
3. Equipment will automatically display with category color tags

### Extending the System
The modular architecture allows easy customization:
- **Database**: Modify schema in `backend/database/`
- **API Routes**: Add endpoints in `backend/routes/`
- **Frontend Components**: Create components in `frontend/src/components/`
- **Pages**: Add new pages in `frontend/src/pages/`

## Development Scripts

From the root `inventory/` directory:
- `npm run dev` - Start both backend and frontend in development mode
- `npm run server` - Start only the backend server
- `npm run client` - Start only the frontend development server
- `npm run install-all` - Install all dependencies (root, backend, frontend)
- `npm run build` - Build frontend for production
- `npm start` - Start backend in production mode

## Deployment

### Production Setup
1. Set environment variable: `NODE_ENV=production`
2. Build the frontend: `npm run build`
3. Configure database backup strategy
4. Set up SSL/HTTPS (use reverse proxy like Nginx)
5. Use process manager (PM2 recommended):
   ```bash
   npm install -g pm2
   pm2 start backend/server.js --name inventory-api
   ```

### Environment Variables
Create `backend/.env` file:
```
PORT=5000
NODE_ENV=production
DATABASE_PATH=./database/inventory.db
```

### Backup Strategy
The SQLite database file should be backed up regularly:
```bash
# Backup command
cp backend/database/inventory.db backups/inventory-$(date +%Y%m%d).db
```

## Troubleshooting

### Common Issues
- **Port already in use**: Change ports in `backend/server.js` (backend) or create `frontend/.env` with `PORT=3001` (frontend)
- **Database locked**: Ensure only one backend instance is running
- **Dependencies error**: Run `npm run install-all` from the root directory
- **Cannot connect to API**: Check firewall settings and that backend is running on correct port

### Debug Mode
Enable detailed logging by checking console output:
- Backend: Check terminal running `npm run server`
- Frontend: Open browser DevTools console (F12)

## Contributing

This is a studio management tool designed for internal use. Feel free to fork and customize for your needs.

## License

MIT License - Free to use and modify for your studio's requirements.