const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
    constructor() {
        this.db = null;
        // Use DB_PATH env var if set, otherwise default to database/ directory
        this.dbPath = process.env.DB_PATH || path.join(__dirname, 'inventory.db');
        this.initSqlPath = path.join(__dirname, 'init.sql');
    }

    async connect() {
        return new Promise((resolve, reject) => {
            // Ensure the database directory exists
            const dbDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.initializeDatabase().then(resolve).catch(reject);
                }
            });
        });
    }

    async initializeDatabase() {
        const dbExists = fs.existsSync(this.dbPath);
        
        if (!dbExists || await this.isEmptyDatabase()) {
            console.log('Initializing database with schema...');
            const initSql = fs.readFileSync(this.initSqlPath, 'utf8');
            
            // Split SQL commands and execute them
            const commands = initSql.split(';').filter(cmd => cmd.trim());
            
            for (const command of commands) {
                if (command.trim()) {
                    await this.run(command);
                }
            }
            console.log('Database initialized successfully');
        }
    }

    async isEmptyDatabase() {
        const result = await this.get("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1");
        return !result;
    }

    // Promisify database methods
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('Database run error:', err);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, result) => {
                if (err) {
                    console.error('Database get error:', err);
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('Database all error:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                    } else {
                        console.log('Database connection closed');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    // Transaction support
    async beginTransaction() {
        await this.run('BEGIN TRANSACTION');
    }

    async commit() {
        await this.run('COMMIT');
    }

    async rollback() {
        await this.run('ROLLBACK');
    }

    // Helper method for paginated queries
    async paginate(baseQuery, params = [], page = 1, limit = 50) {
        const offset = (page - 1) * limit;
        const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery})`;
        const dataQuery = `${baseQuery} LIMIT ? OFFSET ?`;
        
        const [total, rows] = await Promise.all([
            this.get(countQuery, params),
            this.all(dataQuery, [...params, limit, offset])
        ]);
        
        return {
            data: rows,
            pagination: {
                page,
                limit,
                total: total.total,
                pages: Math.ceil(total.total / limit)
            }
        };
    }
}

// Singleton instance
const database = new Database();

module.exports = database;