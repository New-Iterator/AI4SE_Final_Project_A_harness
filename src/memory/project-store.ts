import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface ProjectMemoryEntry {
  id: string;
  type: 'file_summary' | 'module_summary' | 'fix_pattern';
  path: string;
  content: string;
  embedding: Float32Array;
  timestamp: number;
}

export class ProjectStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS project_memory (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        path TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);
  }

  insert(entry: Omit<ProjectMemoryEntry, 'id'>): string {
    const id = randomUUID();
    const stmt = this.db.prepare('INSERT INTO project_memory (id, type, path, content, embedding, timestamp) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(id, entry.type, entry.path, entry.content, Buffer.from(entry.embedding.buffer), entry.timestamp);
    return id;
  }

  getById(id: string): ProjectMemoryEntry | undefined {
    const row = this.db.prepare('SELECT * FROM project_memory WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return rowToEntry(row);
  }

  getAll(): ProjectMemoryEntry[] {
    const rows = this.db.prepare('SELECT * FROM project_memory ORDER BY timestamp DESC').all() as any[];
    return rows.map(rowToEntry);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM project_memory WHERE id = ?').run(id);
  }

  close(): void {
    this.db.close();
  }
}

function rowToEntry(row: any): ProjectMemoryEntry {
  return {
    id: row.id,
    type: row.type,
    path: row.path,
    content: row.content,
    embedding: new Float32Array((row.embedding as Buffer).buffer),
    timestamp: row.timestamp,
  };
}