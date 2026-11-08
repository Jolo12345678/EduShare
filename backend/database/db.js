/**
 * EduShare Database Connection & Initialization
 * Uses Node.js native DatabaseSync (node:sqlite)
 */

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const config = require('../config/env');

let dbInstance = null;

function getDb(customPath = null) {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const dbPath = customPath || config.databaseUrl;

  // Ensure parent directory exists if using a file path
  if (dbPath !== ':memory:') {
    const dir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(dbPath);

  // Set SQLite pragmas for integrity, concurrency, and performance
  db.exec('PRAGMA foreign_keys = ON;');
  if (dbPath !== ':memory:') {
    try {
      db.exec('PRAGMA journal_mode = WAL;');
    } catch {
      // WAL mode may not be supported on certain network drives, silently continue
    }
  }

  // Load and execute schema
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  }

  if (!customPath) {
    dbInstance = db;
  }

  return db;
}

/**
 * Executes a function within a transaction.
 * @param {Function} fn Function taking (db) and executing queries
 * @param {DatabaseSync} [db] Optional database instance
 */
function transaction(fn, db = null) {
  const currentDb = db || getDb();
  currentDb.exec('BEGIN IMMEDIATE TRANSACTION;');
  try {
    const result = fn(currentDb);
    currentDb.exec('COMMIT;');
    return result;
  } catch (err) {
    currentDb.exec('ROLLBACK;');
    throw err;
  }
}

/**
 * Logs a security event without exposing credentials or secrets.
 */
function logSecurityEvent(eventType, { userId = null, email = null, ipAddress = null, details = null } = {}, db = null) {
  try {
    const currentDb = db || getDb();
    const stmt = currentDb.prepare(`
      INSERT INTO security_logs (event_type, user_id, email, ip_address, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(eventType, userId, email, ipAddress, typeof details === 'object' ? JSON.stringify(details) : details, Date.now());
  } catch (err) {
    console.error('[EduShare Security Log Error]', err.message);
  }
}

module.exports = {
  getDb,
  transaction,
  logSecurityEvent
};
