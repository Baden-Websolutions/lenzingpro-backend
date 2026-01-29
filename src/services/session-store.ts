import type { SessionData } from "./cdc-auth.js";

/**
 * In-Memory Session Store
 * For production, replace with Redis or database
 */
export class SessionStore {
  private sessions: Map<string, SessionData> = new Map();
  private sessionIdToUserId: Map<string, string> = new Map();

  /**
   * Store Session Data
   */
  set(sessionId: string, data: SessionData): void {
    this.sessions.set(sessionId, data);
    
    // Map sessionId to userId for quick lookup
    if (data.userInfo?.sub) {
      this.sessionIdToUserId.set(sessionId, data.userInfo.sub);
    }
  }

  /**
   * Get Session Data
   */
  get(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Delete Session
   */
  delete(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session?.userInfo?.sub) {
      this.sessionIdToUserId.delete(sessionId);
    }
    return this.sessions.delete(sessionId);
  }

  /**
   * Check if Session Exists
   */
  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Get All Sessions for a User
   */
  getSessionsByUserId(userId: string): SessionData[] {
    const sessions: SessionData[] = [];
    
    for (const [sessionId, data] of this.sessions.entries()) {
      if (data.userInfo?.sub === userId) {
        sessions.push(data);
      }
    }
    
    return sessions;
  }

  /**
   * Clear All Sessions
   */
  clear(): void {
    this.sessions.clear();
    this.sessionIdToUserId.clear();
  }

  /**
   * Clean Expired Sessions (should be called periodically)
   */
  cleanExpired(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [sessionId, data] of this.sessions.entries()) {
      if (data.expiresAt <= now) {
        this.delete(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get Session Count
   */
  size(): number {
    return this.sessions.size;
  }

  /**
   * Update Session Data
   * Useful for updating tokens after refresh
   */
  update(sessionId: string, data: Partial<SessionData>): boolean {
    const existingSession = this.sessions.get(sessionId);
    if (!existingSession) {
      return false;
    }

    const updatedSession = {
      ...existingSession,
      ...data,
    };

    this.sessions.set(sessionId, updatedSession);
    return true;
  }

  /**
   * Get Session by User ID
   * Returns the first session found for the user
   */
  getByUserId(userId: string): { sessionId: string; data: SessionData } | undefined {
    for (const [sessionId, data] of this.sessions.entries()) {
      if (data.userInfo?.sub === userId || data.userInfo?.uid === userId) {
        return { sessionId, data };
      }
    }
    return undefined;
  }

  /**
   * Delete all sessions for a user
   */
  deleteAllForUser(userId: string): number {
    let deleted = 0;
    const sessionsToDelete: string[] = [];

    for (const [sessionId, data] of this.sessions.entries()) {
      if (data.userInfo?.sub === userId || data.userInfo?.uid === userId) {
        sessionsToDelete.push(sessionId);
      }
    }

    for (const sessionId of sessionsToDelete) {
      if (this.delete(sessionId)) {
        deleted++;
      }
    }

    return deleted;
  }
}
