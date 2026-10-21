import fs from "node:fs/promises";
import path from "node:path";
import type { HonestyEvent, HonestyProfile, DebateSession } from "../types/index.js";

export interface StorageProvider {
  getProfile(userId: string): Promise<HonestyProfile>;
  saveProfile(profile: HonestyProfile): Promise<void>;
  appendEvent(event: HonestyEvent): Promise<void>;
  getEvents(userId: string, limit?: number): Promise<HonestyEvent[]>;
  saveDebateSession(session: DebateSession): Promise<void>;
  getDebateSession(sessionId: string): Promise<DebateSession | null>;
  getAllDebateSessions(userId: string): Promise<DebateSession[]>;
}

export function createDefaultProfile(userId: string): HonestyProfile {
  return {
    userId,
    currentScore: 50.0,
    totalChallenges: 0,
    engagedCount: 0,
    dismissedCount: 0,
    concessionCount: 0,
    engagementRate: 0.0,
    concessionRate: 0.0,
    topicMetrics: {},
    recentEvents: [],
    updatedAt: new Date().toISOString(),
  };
}

interface LocalStoreData {
  profiles: Record<string, HonestyProfile>;
  events: Record<string, HonestyEvent[]>;
  debates: Record<string, DebateSession>;
}

export class FileStorageProvider implements StorageProvider {
  private filePath: string;
  private memoryCache: LocalStoreData | null = null;
  private isLoaded = false;

  constructor(filePath: string = "./data/honesty_ledger.json") {
    this.filePath = path.resolve(process.cwd(), filePath);
  }

  private async ensureInitialized(): Promise<LocalStoreData> {
    if (this.isLoaded && this.memoryCache) {
      return this.memoryCache;
    }

    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      const raw = await fs.readFile(this.filePath, "utf-8");
      this.memoryCache = JSON.parse(raw);
    } catch {
      this.memoryCache = {
        profiles: {},
        events: {},
        debates: {},
      };
      await this.flushToFile();
    }

    this.isLoaded = true;
    return this.memoryCache!;
  }

  private writeQueue: Promise<void> = Promise.resolve();

  private async flushToFile(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      if (!this.memoryCache) return;
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      const content = JSON.stringify(this.memoryCache, null, 2);
      try {
        await fs.writeFile(this.filePath, content, "utf-8");
      } catch (err) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        await fs.writeFile(this.filePath, content, "utf-8");
      }
    });
    return this.writeQueue;
  }

  async getProfile(userId: string): Promise<HonestyProfile> {
    const data = await this.ensureInitialized();
    if (!data.profiles[userId]) {
      data.profiles[userId] = createDefaultProfile(userId);
      await this.flushToFile();
    }
    return JSON.parse(JSON.stringify(data.profiles[userId]));
  }

  async saveProfile(profile: HonestyProfile): Promise<void> {
    const data = await this.ensureInitialized();
    profile.updatedAt = new Date().toISOString();
    data.profiles[profile.userId] = JSON.parse(JSON.stringify(profile));
    await this.flushToFile();
  }

  async appendEvent(event: HonestyEvent): Promise<void> {
    const data = await this.ensureInitialized();
    if (!data.events[event.userId]) {
      data.events[event.userId] = [];
    }
    data.events[event.userId].unshift(JSON.parse(JSON.stringify(event)));
    // Keep max 500 events in memory/file
    if (data.events[event.userId].length > 500) {
      data.events[event.userId] = data.events[event.userId].slice(0, 500);
    }
    await this.flushToFile();
  }

  async getEvents(userId: string, limit: number = 20): Promise<HonestyEvent[]> {
    const data = await this.ensureInitialized();
    const userEvents = data.events[userId] || [];
    return JSON.parse(JSON.stringify(userEvents.slice(0, limit)));
  }

  async saveDebateSession(session: DebateSession): Promise<void> {
    const data = await this.ensureInitialized();
    session.updatedAt = new Date().toISOString();
    data.debates[session.sessionId] = JSON.parse(JSON.stringify(session));
    await this.flushToFile();
  }

  async getDebateSession(sessionId: string): Promise<DebateSession | null> {
    const data = await this.ensureInitialized();
    const session = data.debates[sessionId];
    return session ? JSON.parse(JSON.stringify(session)) : null;
  }

  async getAllDebateSessions(userId: string): Promise<DebateSession[]> {
    const data = await this.ensureInitialized();
    return Object.values(data.debates)
      .filter((d) => d.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
}

// Global singleton instance
export const sessionStore: StorageProvider = new FileStorageProvider(
  process.env.STORAGE_FILE_PATH || "./data/honesty_ledger.json"
);
