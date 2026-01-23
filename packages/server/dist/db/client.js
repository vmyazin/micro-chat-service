"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = exports.DatabaseError = void 0;
class DatabaseError extends Error {
    query;
    cause;
    constructor(message, query, cause) {
        super(message);
        this.query = query;
        this.cause = cause;
        this.name = 'DatabaseError';
    }
}
exports.DatabaseError = DatabaseError;
class Database {
    db;
    constructor(db) {
        this.db = db;
    }
    async query(sql, params = []) {
        try {
            let statement = this.db.prepare(sql);
            if (params.length > 0) {
                statement = statement.bind(...params);
            }
            const result = await statement.all();
            if (!result.success) {
                throw new DatabaseError(result.error || 'Query failed', sql);
            }
            return result.results ?? [];
        }
        catch (error) {
            if (error instanceof DatabaseError) {
                throw error;
            }
            throw new DatabaseError(error instanceof Error ? error.message : 'Unknown database error', sql, error);
        }
    }
    async execute(sql, params = []) {
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
        }
        catch (error) {
            if (error instanceof DatabaseError) {
                throw error;
            }
            throw new DatabaseError(error instanceof Error ? error.message : 'Unknown database error', sql, error);
        }
    }
    async batch(queries) {
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
                    throw new DatabaseError(results[i].error || 'Batch query failed', queries[i].sql);
                }
            }
            return results;
        }
        catch (error) {
            if (error instanceof DatabaseError) {
                throw error;
            }
            throw new DatabaseError(error instanceof Error ? error.message : 'Unknown database error', undefined, error);
        }
    }
}
exports.Database = Database;
//# sourceMappingURL=client.js.map