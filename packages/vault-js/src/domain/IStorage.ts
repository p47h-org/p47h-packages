import type { EncryptedVaultBlob } from './types';

/**
 * Puerto para la persistencia de datos (Storage Port).
 * Implementado por adaptadores de infraestructura (IndexedDB, InMemory, etc).
 */
export interface IStorage {
  /**
   * Guarda un blob cifrado asociado a un ID (DID).
   */
  save(key: string, data: EncryptedVaultBlob): Promise<void>;

  /**
   * Recupera un blob cifrado por su ID.
   * Retorna null si no existe.
   */
  get(key: string): Promise<EncryptedVaultBlob | null>;

  /**
   * Elimina un blob del almacenamiento.
   */
  remove(key: string): Promise<void>;

  /**
   * Lista todos los IDs (DIDs) almacenados.
   */
  listKeys(): Promise<string[]>;

  /**
   * Limpia todo el almacenamiento (Cuidado: destructivo).
   */
  clear(): Promise<void>;
}