// airport-api/server.js (Corrected for API-only service)

// --- Import Required Packages ---
const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const cors = require('cors');

// --- Initialize the Express App ---
const app = express();
const PORT = process.env.PORT || 3001;

// --- Setup Middleware ---
app.use(cors());
app.use(express.json());

// --- Billing Calculation Helper ---
const calculateFee = (isoString) => {
    if (!isoString) return { durationMinutes: 0, fee: 0 };
    const now = new Date();
    const then = new Date(isoString);
    const diffMinutes = Math.round((now - then) / (1000 * 60));
    const diffHours = diffMinutes / 60;
    let fee;
    if (diffHours <= 1) fee = 100;
    else if (diffHours <= 3) fee = 200;
    else if (diffHours <= 6) fee = 300;
    else fee = 500;
    return { durationMinutes: diffMinutes, fee };
};

// --- Database Connection and Setup ---
let db;
(async () => {
    try {
        db = await open({ filename: './luggage.db', driver: sqlite3.Database });
        await db.exec(`CREATE TABLE IF NOT EXISTS lockers (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT NOT NULL UNIQUE, type TEXT NOT NULL, status TEXT NOT NULL, checkInTime TEXT)`);
        await db.exec(`CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, locker_id INTEGER, locker_number TEXT NOT NULL, check_in_time TEXT NOT NULL, check_out_time TEXT NOT NULL, duration_minutes INTEGER NOT NULL, fee_charged REAL NOT NULL, FOREIGN KEY (locker_id) REFERENCES lockers(id))`);
        const lockerCount = await db.get('SELECT COUNT(*) as count FROM lockers');
        if (lockerCount.count < 170) {
            console.log('Database is not fully populated. Seeding initial locker data...');
            await seedDatabase();
        }
    } catch (error) {
        console.error("Error setting up database:", error);
    }
})();

// --- Database Seeding Function ---
async function seedDatabase() {
    const types = { Small: 80, Medium: 50, Large: 30, VIP: 10 };
    const insertStatement = await db.prepare('INSERT OR IGNORE INTO lockers (number, type, status) VALUES (?, ?, ?)');
    for (const [type, count] of Object.entries(types)) {
        for (let i = 1; i <= count; i++) {
            const number = `${type.charAt(0)}-${100 + i}`;
            await insertStatement.run(number, type, 'Free');
        }
    }
    await insertStatement.finalize();
    console.log('Database seeding process complete.');
}

// --- API Endpoints ---
app.get('/api/dashboard', async (req, res) => {
    try {
        const allLockers = await db.all('SELECT * FROM lockers ORDER BY number');
        const stats = {
            total: allLockers.length,
            occupied: allLockers.filter(l => l.status === 'Occupied').length,
            free: allLockers.filter(l => l.status === 'Free').length,
        };
        const recentReceipts = await db.all('SELECT * FROM transactions ORDER BY id DESC LIMIT 50');
        res.status(200).json({
            stats: stats,
            lockers: allLockers,
            receipts: recentReceipts
        });
    } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.post('/api/checkin', async (req, res) => {
    const { luggageType } = req.body;
    if (!luggageType) {
        return res.status(400).json({ success: false, message: 'Luggage type is required.' });
    }
    try {
        const availableLocker = await db.get('SELECT * FROM lockers WHERE type = ? AND status = ? LIMIT 1', [luggageType, 'Free']);
        if (availableLocker) {
            await db.run('UPDATE lockers SET status = ?, checkInTime = ? WHERE id = ?', ['Occupied', new Date().toISOString(), availableLocker.id]);
            res.status(200).json({ success: true, assigned_locker: availableLocker.number });
        } else {
            res.status(409).json({ success: false, message: `No ${luggageType} lockers are available.` });
        }
    } catch (error) {
        console.error('Failed to check in luggage:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.post('/api/checkout', async (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ success: false, message: 'Locker ID is required.' });
    }
    try {
        await db.run('BEGIN TRANSACTION');
        const locker = await db.get('SELECT * FROM lockers WHERE id = ?', [id]);
        if (!locker) {
            await db.run('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Locker not found.' });
        }
        if (locker.status === 'Free') {
            await db.run('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Locker is already free.' });
        }
        const { durationMinutes, fee } = calculateFee(locker.checkInTime);
        const checkOutTime = new Date().toISOString();
        await db.run(`INSERT INTO transactions (locker_id, locker_number, check_in_time, check_out_time, duration_minutes, fee_charged) VALUES (?, ?, ?, ?, ?, ?)`, [locker.id, locker.number, locker.checkInTime, checkOutTime, durationMinutes ?? 0, fee ?? 0]);
        await db.run('UPDATE lockers SET status = ?, checkInTime = ? WHERE id = ?', ['Free', null, id]);
        await db.run('COMMIT');
        res.status(200).json({ success: true, message: `Locker ${locker.number} is now free.` });
    } catch (error) {
        await db.run('ROLLBACK');
        console.error('Failed to check out luggage:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error during checkout.' });
    }
});

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});