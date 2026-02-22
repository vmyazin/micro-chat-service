import type { D1Database, D1PreparedStatement, D1Result } from '../db/client';

interface MockRow {
  [key: string]: unknown;
}

interface MockTable {
  rows: MockRow[];
}

export class MockD1Database implements D1Database {
  private tables = new Map<string, MockTable>();
  private lastInsertId = 0;

  prepare(query: string): D1PreparedStatement {
    return new MockD1PreparedStatement(this, query);
  }

  batch<T = unknown>(
    statements: D1PreparedStatement[],
  ): Promise<D1Result<T>[]> {
    return Promise.all(
      statements.map((stmt) => (stmt as MockD1PreparedStatement).run<T>()),
    );
  }

  async exec(_query: string): Promise<{ count: number; duration: number }> {
    return { count: 0, duration: 0 };
  }

  _execute<T = unknown>(query: string, params: unknown[]): D1Result<T> {
    const trimmed = query.trim().toUpperCase();

    if (trimmed.startsWith('CREATE TABLE')) {
      const match = query.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/i);
      if (match) {
        this.tables.set(match[1], { rows: [] });
      }
      return { success: true, results: [] };
    }

    if (trimmed.startsWith('INSERT')) {
      return this._handleInsert(query, params) as D1Result<T>;
    }

    if (trimmed.startsWith('SELECT')) {
      return this._handleSelect(query, params) as D1Result<T>;
    }

    if (trimmed.startsWith('UPDATE')) {
      return this._handleUpdate(query, params) as D1Result<T>;
    }

    if (trimmed.startsWith('DELETE')) {
      return this._handleDelete(query, params) as D1Result<T>;
    }

    return { success: true, results: [] };
  }

  private _handleInsert(query: string, params: unknown[]): D1Result {
    const match = query.match(/INSERT INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES/i);
    if (!match) return { success: true };

    const table = match[1];
    const columns = match[2].split(',').map((c) => c.trim());
    const row: MockRow = {};
    for (let i = 0; i < columns.length; i++) {
      row[columns[i]] = params[i] ?? null;
    }

    if (!this.tables.has(table)) {
      this.tables.set(table, { rows: [] });
    }
    this.tables.get(table)?.rows.push(row);
    this.lastInsertId++;

    return {
      success: true,
      meta: {
        duration: 0,
        changes: 1,
        last_row_id: this.lastInsertId,
        rows_read: 0,
        rows_written: 1,
      },
    };
  }

  private _handleSelect(query: string, params: unknown[]): D1Result {
    const match = query.match(/FROM\s+(\w+)/i);
    if (!match) return { success: true, results: [] };

    const table = match[1];
    const data = this.tables.get(table);
    if (!data) return { success: true, results: [] };

    let rows = [...data.rows];

    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s*$)/is);
    if (whereMatch) {
      rows = this._filterRows(rows, whereMatch[1], params);
    }

    const limitMatch = query.match(/LIMIT\s+\?/i);
    if (limitMatch) {
      const limitParam = params[params.length - 1];
      if (typeof limitParam === 'number') {
        rows = rows.slice(0, limitParam);
      }
    }

    return { success: true, results: rows };
  }

  private _handleUpdate(_query: string, params: unknown[]): D1Result {
    const match = _query.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/is);
    if (!match) return { success: true };

    const table = match[1];
    const data = this.tables.get(table);
    if (!data)
      return {
        success: true,
        meta: {
          duration: 0,
          changes: 0,
          last_row_id: 0,
          rows_read: 0,
          rows_written: 0,
        },
      };

    const setClauses = match[2].split(',').map((c) => c.trim());
    const setColumns = setClauses.map((c) => c.split('=')[0].trim());

    const whereParams = params.slice(setColumns.length);
    const setParams = params.slice(0, setColumns.length);

    let changes = 0;
    const rows = this._filterRows(data.rows, match[3], whereParams);
    for (const row of rows) {
      for (let i = 0; i < setColumns.length; i++) {
        row[setColumns[i]] = setParams[i];
      }
      changes++;
    }

    return {
      success: true,
      meta: {
        duration: 0,
        changes,
        last_row_id: 0,
        rows_read: rows.length,
        rows_written: changes,
      },
    };
  }

  private _handleDelete(query: string, params: unknown[]): D1Result {
    const match = query.match(/DELETE FROM\s+(\w+)(?:\s+WHERE\s+(.+))?/is);
    if (!match) return { success: true };

    const table = match[1];
    const data = this.tables.get(table);
    if (!data)
      return {
        success: true,
        meta: {
          duration: 0,
          changes: 0,
          last_row_id: 0,
          rows_read: 0,
          rows_written: 0,
        },
      };

    if (!match[2]) {
      const count = data.rows.length;
      data.rows = [];
      return {
        success: true,
        meta: {
          duration: 0,
          changes: count,
          last_row_id: 0,
          rows_read: count,
          rows_written: count,
        },
      };
    }

    const before = data.rows.length;
    const toKeep = data.rows.filter((row) => {
      const matches = this._filterRows([row], match[2], params);
      return matches.length === 0;
    });
    data.rows = toKeep;
    const changes = before - toKeep.length;

    return {
      success: true,
      meta: {
        duration: 0,
        changes,
        last_row_id: 0,
        rows_read: before,
        rows_written: changes,
      },
    };
  }

  private _filterRows(
    rows: MockRow[],
    whereClause: string,
    params: unknown[],
  ): MockRow[] {
    const conditions = whereClause.split(/\s+AND\s+/i);
    let paramIdx = 0;

    return rows.filter((row) => {
      let localIdx = paramIdx;
      const match = conditions.every((cond) => {
        const eqMatch = cond.trim().match(/^(\w+(?:\.\w+)?)\s*=\s*\?$/);
        if (eqMatch) {
          const col = eqMatch[1].includes('.')
            ? eqMatch[1].split('.')[1]
            : eqMatch[1];
          return row[col] === params[localIdx++];
        }
        const ltMatch = cond.trim().match(/^(\w+(?:\.\w+)?)\s*<\s*\?$/);
        if (ltMatch) {
          const col = ltMatch[1].includes('.')
            ? ltMatch[1].split('.')[1]
            : ltMatch[1];
          localIdx++;
          return (row[col] as string) < (params[localIdx - 1] as string);
        }
        
        // Handle IN (SELECT id FROM messages WHERE created_at < ?)
        const inMatch = cond.trim().match(/^(\w+(?:\.\w+)?)\s+IN\s+\(SELECT\s+id\s+FROM\s+messages\s+WHERE\s+created_at\s*<\s*\?\)$/i);
        if (inMatch) {
          const col = inMatch[1].includes('.') ? inMatch[1].split('.')[1] : inMatch[1];
          const cutoff = params[localIdx++];
          const msgTable = this.tables.get('messages');
          const validIds = new Set(msgTable?.rows.filter(r => (r.created_at as string) < (cutoff as string)).map(r => r.id));
          return validIds.has(row[col] as string);
        }

        localIdx++;
        return true;
      });
      paramIdx = localIdx;
      return match;
    });
  }

  _seed(table: string, rows: MockRow[]): void {
    this.tables.set(table, { rows: [...rows] });
  }

  _getTable(table: string): MockRow[] {
    return this.tables.get(table)?.rows ?? [];
  }
}

class MockD1PreparedStatement implements D1PreparedStatement {
  private params: unknown[] = [];

  constructor(
    private db: MockD1Database,
    private query: string,
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.params = values;
    return this;
  }

  async first<T = unknown>(_column?: string): Promise<T | null> {
    const result = this.db._execute<T>(this.query, this.params);
    const rows = result.results as T[];
    return rows?.[0] ?? null;
  }

  async run<T = unknown>(): Promise<D1Result<T>> {
    return this.db._execute<T>(this.query, this.params);
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    return this.db._execute<T>(this.query, this.params);
  }

  async raw<T = unknown>(): Promise<T[]> {
    const result = this.db._execute<T>(this.query, this.params);
    return result.results ?? [];
  }
}
