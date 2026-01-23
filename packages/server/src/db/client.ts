export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: {
    duration: number;
    changes: number;
    last_row_id: number;
    rows_read: number;
    rows_written: number;
  };
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly query?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class Database {
  constructor(private readonly db: D1Database) {}

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    try {
      let statement = this.db.prepare(sql);
      if (params.length > 0) {
        statement = statement.bind(...params);
      }
      const result = await statement.all<T>();
      if (!result.success) {
        throw new DatabaseError(result.error || 'Query failed', sql);
      }
      return result.results ?? [];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        error instanceof Error ? error.message : 'Unknown database error',
        sql,
        error
      );
    }
  }

  async execute(sql: string, params: unknown[] = []): Promise<D1Result> {
    try {
      let statement = this.db.prepare(sql);
      if (params.length > 0) {
        statement = statement.bind(...params);
      }
      const result = await statement.run();
      if (!result.success) {
        throw new DatabaseError(result.error || 'Execute failed', sql);
      }
      return result;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        error instanceof Error ? error.message : 'Unknown database error',
        sql,
        error
      );
    }
  }

  async batch(
    queries: Array<{ sql: string; params?: unknown[] }>
  ): Promise<D1Result[]> {
    try {
      const statements = queries.map(({ sql, params = [] }) => {
        let statement = this.db.prepare(sql);
        if (params.length > 0) {
          statement = statement.bind(...params);
        }
        return statement;
      });
      const results = await this.db.batch(statements);
      for (let i = 0; i < results.length; i++) {
        if (!results[i].success) {
          throw new DatabaseError(
            results[i].error || 'Batch query failed',
            queries[i].sql
          );
        }
      }
      return results;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        error instanceof Error ? error.message : 'Unknown database error',
        undefined,
        error
      );
    }
  }
}
