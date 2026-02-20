import type { D1Database } from '../db/client';
import { Database } from '../db/client';

export interface ChallengeData {
  challenge: string;
  userId?: string;
  displayName?: string;
  expiresAt: number;
  type: 'registration' | 'authentication';
}

export class ChallengeStore {
  private db: Database;

  constructor(d1: D1Database) {
    this.db = new Database(d1);
  }

  async set(data: ChallengeData): Promise<void> {
    const expiresAtIso = new Date(data.expiresAt).toISOString();
    await this.db.execute(
      'INSERT INTO challenges (challenge, user_id, display_name, type, expires_at) VALUES (?, ?, ?, ?, ?)',
      [
        data.challenge,
        data.userId ?? null,
        data.displayName ?? null,
        data.type,
        expiresAtIso,
      ],
    );
  }

  async get(challenge: string): Promise<ChallengeData | null> {
    const rows = await this.db.query<{
      challenge: string;
      user_id: string | null;
      display_name: string | null;
      type: 'registration' | 'authentication';
      expires_at: string;
    }>(
      'SELECT challenge, user_id, display_name, type, expires_at FROM challenges WHERE challenge = ?',
      [challenge],
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      challenge: row.challenge,
      userId: row.user_id ?? undefined,
      displayName: row.display_name ?? undefined,
      type: row.type,
      expiresAt: new Date(row.expires_at).getTime(),
    };
  }

  async delete(challenge: string): Promise<void> {
    await this.db.execute('DELETE FROM challenges WHERE challenge = ?', [
      challenge,
    ]);
  }

  async deleteExpired(): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.db.execute(
      'DELETE FROM challenges WHERE expires_at < ?',
      [now],
    );
    return result.meta?.changes ?? 0;
  }
}
