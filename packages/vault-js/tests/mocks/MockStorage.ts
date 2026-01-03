import type { IStorage } from '../../src/domain/IStorage';
import type { EncryptedVaultBlob } from '../../src/domain/types';

export class MockStorage implements IStorage {
  private db = new Map<string, EncryptedVaultBlob>();

  async save(key: string, data: EncryptedVaultBlob): Promise<void> {
    this.db.set(key, data);
  }

  async get(key: string): Promise<EncryptedVaultBlob | null> {
    return this.db.get(key) || null;
  }

  async remove(key: string): Promise<void> {
    this.db.delete(key);
  }

  async listKeys(): Promise<string[]> {
    return Array.from(this.db.keys());
  }

  async clear(): Promise<void> {
    this.db.clear();
  }
}