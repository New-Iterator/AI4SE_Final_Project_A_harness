import Database from 'better-sqlite3';
import type { SessionMemoryEntry } from './types';

export class SessionStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        keywords TEXT NOT NULL DEFAULT '',
        timestamp INTEGER NOT NULL,
        confidence REAL NOT NULL DEFAULT 1.0
      );
      CREATE INDEX IF NOT EXISTS idx_session_id ON session_memory(sessionId);
      CREATE INDEX IF NOT EXISTS idx_type ON session_memory(type);
    `);
  }

  insert(entry: SessionMemoryEntry): void {
    const stmt = this.db.prepare(
      'INSERT INTO session_memory (sessionId, type, content, metadata, keywords, timestamp, confidence) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    stmt.run(entry.sessionId, entry.type, entry.content, entry.metadata, entry.keywords, entry.timestamp, entry.confidence);
  }

  search(keyword: string, limit: number = 5): SessionMemoryEntry[] {
    const stmt = this.db.prepare(
      'SELECT * FROM session_memory WHERE keywords LIKE ? ORDER BY timestamp DESC LIMIT ?'
    );
    return stmt.all(`%${keyword}%`, limit) as SessionMemoryEntry[];
  }

  searchBySession(keyword: string, sessionId: string, limit: number = 5): SessionMemoryEntry[] {
    const stmt = this.db.prepare(
      'SELECT * FROM session_memory WHERE keywords LIKE ? AND sessionId = ? ORDER BY timestamp DESC LIMIT ?'
    );
    return stmt.all(`%${keyword}%`, sessionId, limit) as SessionMemoryEntry[];
  }

  getBySession(sessionId: string): SessionMemoryEntry[] {
    return this.db.prepare('SELECT * FROM session_memory WHERE sessionId = ? ORDER BY timestamp DESC').all(sessionId) as SessionMemoryEntry[];
  }

  deleteSession(sessionId: string): void {
    this.db.prepare('DELETE FROM session_memory WHERE sessionId = ?').run(sessionId);
  }

  deleteById(id: number): void {
    this.db.prepare('DELETE FROM session_memory WHERE id = ?').run(id);
  }

  cleanExpired(expireDays: number): number {
    const cutoff = Date.now() - expireDays * 24 * 60 * 60 * 1000;
    const result = this.db.prepare('DELETE FROM session_memory WHERE timestamp < ?').run(cutoff);
    return result.changes;
  }

  close(): void {
    this.db.close();
  }
}