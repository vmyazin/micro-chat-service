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
export declare class DatabaseError extends Error {
    readonly query?: string | undefined;
    readonly cause?: unknown | undefined;
    constructor(message: string, query?: string | undefined, cause?: unknown | undefined);
}
export declare class Database {
    private readonly db;
    constructor(db: D1Database);
    query<T>(sql: string, params?: unknown[]): Promise<T[]>;
    execute(sql: string, params?: unknown[]): Promise<D1Result>;
    batch(queries: Array<{
        sql: string;
        params?: unknown[];
    }>): Promise<D1Result[]>;
}
//# sourceMappingURL=client.d.ts.map