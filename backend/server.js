const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const dotenv = require('dotenv');
const fs = require('fs');
const database = require('./database/connection');

// Load environment variables
dotenv.config();

// Load application version
try {
    const versionPath = path.join(__dirname, '..', 'version.json');
    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    process.env.APP_VERSION = versionData.version;
    console.log(`Application version: ${process.env.APP_VERSION}`);
} catch (error) {
    console.warn('Warning: Could not load version.json, using default version 1.0.0');
    process.env.APP_VERSION = '1.0.0';
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Initialize utilities
const { ensureLogDir } = require('./utils/activityLogger');
const { syncChangelogToDatabase } = require('./utils/syncChangelog');

// Import routes
const authRoutes = require('./routes/auth');
const equipmentRoutes = require('./routes/equipment');
const userRoutes = require('./routes/users');
const transactionRoutes = require('./routes/transactions');
const categoryRoutes = require('./routes/categories');
const maintenanceRoutes = require('./routes/maintenance');
const reportRoutes = require('./routes/reports');
const importRoutes = require('./routes/import');
const versionRoutes = require('./routes/version');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/import', importRoutes);
app.use('/api/version', versionRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Studio Inventory API is running',
        version: process.env.APP_VERSION || '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Error:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        }
    }
    
    res.status(error.status || 500).json({
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Endpoint not found',
        path: req.originalUrl 
    });
});

// Start server
async function startServer() {
    try {
        // Connect to database
        await database.connect();

        // Ensure log directory exists
        await ensureLogDir();
        console.log('Activity logging initialized');

        // Sync CHANGELOG.md to release_notes database
        await syncChangelogToDatabase(database);

        // Start listening
        app.listen(PORT, () => {
            console.log(`Studio Inventory API server running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/api/health`);
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\nReceived SIGINT. Graceful shutdown...');
            await database.close();
            process.exit(0);
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();