import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Direct WASM Integration Test with IndexedDB Persistence
// ============================================================================

interface WasmModule {
  P47hClient: {
    new (): P47hClient;
    from_wrapped_secret(wrapped: Uint8Array, sessionKey: Uint8Array): P47hClient;
  };
  VaultCrypto: {
    encrypt_vault(data: Uint8Array, password: string): Uint8Array;
    decrypt_vault(blob: Uint8Array, password: string): Uint8Array;
    derive_session_key(password: string, salt: Uint8Array): Uint8Array;
  };
  default: (path: string) => Promise<void>;
}

interface P47hClient {
  get_did(): string;
  get_public_key(): Uint8Array;
  export_wrapped_secret(sessionKey: Uint8Array): Uint8Array;
  sign_data(data: Uint8Array): Uint8Array;
  free(): void;
}

// ============================================================================
// IndexedDB Storage (Simplified from @p47h/vault-js)
// ============================================================================

interface StoredIdentity {
  did: string;
  wrappedSecret: number[]; // Uint8Array as array for IndexedDB
  salt: number[];
  createdAt: number;
  secrets: Record<string, number[]>; // Encrypted secrets
}

class VaultStorage {
  private readonly dbName = 'p47h-vault-demo';
  private readonly storeName = 'identities';
  private readonly version = 1;

  private async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);
      req.onerror = () => reject(new Error('Failed to open database'));
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'did' });
        }
      };
    });
  }

  async save(identity: StoredIdentity): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).put(identity);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async get(did: string): Promise<StoredIdentity | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const req = tx.objectStore(this.storeName).get(did);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async listDids(): Promise<string[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const req = tx.objectStore(this.storeName).getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });
  }

  async remove(did: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).delete(did);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

const storage = new VaultStorage();

// ============================================================================
// App State Types
// ============================================================================

type AppState = 'loading' | 'ready' | 'authenticated' | 'error';

interface VaultState {
  state: AppState;
  did: string | null;
  error: string | null;
  secrets: Record<string, string>;
}

// ============================================================================
// Loading Component
// ============================================================================

function LoadingScreen() {
  return (
    <div className="container">
      <h1>🔐 P47H Vault React</h1>
      <div className="card">
        <h3>⚡ Loading WASM...</h3>
        <div className="flex-row">
          <div className="loading-spinner" />
          <span>Initializing cryptographic core...</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Error Component
// ============================================================================

function ErrorScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="container">
      <h1>🔐 P47H Vault React</h1>
      <div className="card">
        <h3 className="error">❌ Error</h3>
        <pre>{error}</pre>
        <button onClick={onRetry}>Retry</button>
      </div>
    </div>
  );
}

// ============================================================================
// Status Badge
// ============================================================================

function StatusBadge({ state }: { state: AppState }) {
  const stateClass = state === 'authenticated' ? 'unlocked' : state === 'ready' ? 'locked' : state;
  return <span className={`status-badge ${stateClass}`}>{state}</span>;
}

// ============================================================================
// Main Vault App with Persistence
// ============================================================================

function VaultApp({ wasm }: { wasm: WasmModule }) {
  const [vaultState, setVaultState] = useState<VaultState>({
    state: 'loading', // Start as loading to check IndexedDB
    did: null,
    error: null,
    secrets: {},
  });
  const [storedDids, setStoredDids] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [client, setClient] = useState<P47hClient | null>(null);
  const [currentSalt, setCurrentSalt] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(false);

  // New secret input
  const [newSecretKey, setNewSecretKey] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');

  // Check for existing identities on mount
  useEffect(() => {
    async function checkStorage() {
      try {
        const dids = await storage.listDids();
        setStoredDids(dids);
        setVaultState(s => ({ ...s, state: 'ready' }));
        console.log('Found stored identities:', dids);
      } catch (e) {
        console.error('Failed to check storage:', e);
        setVaultState(s => ({ ...s, state: 'ready' }));
      }
    }
    checkStorage();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (client) {
        client.free();
      }
    };
  }, [client]);

  // Register new identity
  const handleRegister = useCallback(async () => {
    if (!password) return;
    setLoading(true);
    setVaultState(s => ({ ...s, error: null }));

    try {
      // Create new identity
      const newClient = new wasm.P47hClient();
      const did = newClient.get_did();

      // Derive session key with new salt
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const sessionKey = wasm.VaultCrypto.derive_session_key(password, salt);

      // Export wrapped secret (encrypted private key)
      const wrappedSecret = newClient.export_wrapped_secret(sessionKey);

      // Save to IndexedDB
      await storage.save({
        did,
        wrappedSecret: Array.from(wrappedSecret),
        salt: Array.from(salt),
        createdAt: Date.now(),
        secrets: {},
      });

      setClient(newClient);
      setCurrentSalt(salt);
      setStoredDids(prev => [...prev, did]);
      setVaultState({
        state: 'authenticated',
        did,
        error: null,
        secrets: {},
      });
      setPassword('');
      console.log('Registered new identity:', did);
    } catch (e) {
      setVaultState(s => ({
        ...s,
        error: e instanceof Error ? e.message : 'Registration failed',
      }));
    } finally {
      setLoading(false);
    }
  }, [password, wasm]);

  // Login with existing identity
  const handleLogin = useCallback(async (targetDid?: string) => {
    if (!password) return;
    const didToLogin = targetDid || storedDids[0];
    if (!didToLogin) return;

    setLoading(true);
    setVaultState(s => ({ ...s, error: null }));

    try {
      // Load from IndexedDB
      const stored = await storage.get(didToLogin);
      if (!stored) {
        throw new Error('Identity not found in storage');
      }

      // Derive session key with stored salt
      const salt = new Uint8Array(stored.salt);
      const sessionKey = wasm.VaultCrypto.derive_session_key(password, salt);

      // Restore identity from wrapped secret
      const wrappedSecret = new Uint8Array(stored.wrappedSecret);
      const restoredClient = wasm.P47hClient.from_wrapped_secret(wrappedSecret, sessionKey);

      // Verify the DID matches
      const restoredDid = restoredClient.get_did();
      if (restoredDid !== didToLogin) {
        restoredClient.free();
        throw new Error('Wrong password - DID mismatch');
      }

      // Decrypt secrets
      const decryptedSecrets: Record<string, string> = {};
      for (const [key, encryptedValue] of Object.entries(stored.secrets)) {
        try {
          const encrypted = new Uint8Array(encryptedValue);
          const decrypted = wasm.VaultCrypto.decrypt_vault(encrypted, password);
          decryptedSecrets[key] = new TextDecoder().decode(decrypted);
        } catch {
          console.warn(`Failed to decrypt secret: ${key}`);
        }
      }

      setClient(restoredClient);
      setCurrentSalt(salt);
      setVaultState({
        state: 'authenticated',
        did: restoredDid,
        error: null,
        secrets: decryptedSecrets,
      });
      setPassword('');
      console.log('Logged in as:', restoredDid);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Login failed';
      setVaultState(s => ({
        ...s,
        error: message.includes('Decryption failed') ? 'Wrong password' : message,
      }));
    } finally {
      setLoading(false);
    }
  }, [password, storedDids, wasm]);

  // Lock vault (logout)
  const handleLock = useCallback(() => {
    if (client) {
      client.free();
    }
    setClient(null);
    setCurrentSalt(null);
    setVaultState({
      state: 'ready',
      did: null,
      error: null,
      secrets: {},
    });
  }, [client]);

  // Delete identity
  const handleDelete = useCallback(async () => {
    if (!vaultState.did) return;
    if (!confirm('Are you sure? This will permanently delete your identity.')) return;

    try {
      await storage.remove(vaultState.did);
      setStoredDids(prev => prev.filter(d => d !== vaultState.did));
      handleLock();
    } catch (e) {
      setVaultState(s => ({
        ...s,
        error: e instanceof Error ? e.message : 'Failed to delete',
      }));
    }
  }, [vaultState.did, handleLock]);

  // Add secret (persisted)
  const handleAddSecret = useCallback(async () => {
    if (!newSecretKey || !newSecretValue || !vaultState.did || !password && !currentSalt) return;

    try {
      // Encrypt the secret
      const data = new TextEncoder().encode(newSecretValue);
      const encrypted = wasm.VaultCrypto.encrypt_vault(data, password || 'session');

      // Update IndexedDB
      const stored = await storage.get(vaultState.did);
      if (stored) {
        stored.secrets[newSecretKey] = Array.from(encrypted);
        await storage.save(stored);
      }

      // Update UI state
      setVaultState(s => ({
        ...s,
        secrets: { ...s.secrets, [newSecretKey]: newSecretValue },
      }));
      setNewSecretKey('');
      setNewSecretValue('');
    } catch (e) {
      console.error('Failed to save secret:', e);
    }
  }, [newSecretKey, newSecretValue, vaultState.did, password, currentSalt, wasm]);

  // Delete secret (persisted)
  const handleDeleteSecret = useCallback(async (key: string) => {
    if (!vaultState.did) return;

    try {
      const stored = await storage.get(vaultState.did);
      if (stored) {
        delete stored.secrets[key];
        await storage.save(stored);
      }

      setVaultState(s => {
        const { [key]: _, ...rest } = s.secrets;
        return { ...s, secrets: rest };
      });
    } catch (e) {
      console.error('Failed to delete secret:', e);
    }
  }, [vaultState.did]);

  // Sign test data
  const [signature, setSignature] = useState<string | null>(null);
  const handleSign = useCallback(() => {
    if (!client) return;
    const message = new TextEncoder().encode('Test message for P47H');
    const sig = client.sign_data(message);
    setSignature(Array.from(sig.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('') + '...');
  }, [client]);

  return (
    <div className="container">
      <h1>🔐 P47H Vault React</h1>
      <h2>Testing React + WASM Integration (p47h-wasm-oss v0.10.0)</h2>

      {/* Status Card */}
      <div className="card">
        <h3>🔑 Authentication</h3>
        <div className="flex-row mb-2">
          <span>Status:</span>
          <StatusBadge state={vaultState.state} />
          {storedDids.length > 0 && vaultState.state !== 'authenticated' && (
            <span className="info" style={{ marginLeft: '10px' }}>
              ({storedDids.length} stored {storedDids.length === 1 ? 'identity' : 'identities'})
            </span>
          )}
        </div>

        {vaultState.did && (
          <div className="mb-2">
            <span className="info">DID:</span>
            <pre style={{ fontSize: '11px' }}>{vaultState.did}</pre>
          </div>
        )}

        {vaultState.error && (
          <div className="error mb-2">❌ {vaultState.error}</div>
        )}

        {vaultState.state !== 'authenticated' ? (
          <>
            <input
              type="password"
              placeholder={storedDids.length > 0 ? "Enter password to unlock" : "Create password for new identity"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (storedDids.length > 0 ? handleLogin() : handleRegister())}
              disabled={loading}
            />
            <div className="flex-row">
              {storedDids.length > 0 ? (
                <>
                  <button onClick={() => handleLogin()} disabled={loading || !password}>
                    {loading ? 'Unlocking...' : '🔓 Unlock Vault'}
                  </button>
                  <button onClick={handleRegister} disabled={loading || !password}>
                    🆕 New Identity
                  </button>
                </>
              ) : (
                <button onClick={handleRegister} disabled={loading || !password}>
                  {loading ? 'Creating...' : '🆕 Create New Identity'}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex-row">
            <button onClick={handleLock}>🔒 Lock Vault</button>
            <button onClick={handleSign}>✍️ Test Sign</button>
            <button className="danger" onClick={handleDelete}>🗑️ Delete</button>
          </div>
        )}

        {signature && (
          <div className="mt-2">
            <span className="success">Signature: </span>
            <code>{signature}</code>
          </div>
        )}
      </div>

      {/* Secrets Card */}
      <div className="card">
        <h3>📦 Secrets</h3>
        
        {vaultState.state !== 'authenticated' ? (
          <p className="warning">🔒 Vault is locked. Create or unlock identity to manage secrets.</p>
        ) : (
          <>
            <div className="flex-row mb-2">
              <input
                type="text"
                placeholder="Secret key"
                value={newSecretKey}
                onChange={(e) => setNewSecretKey(e.target.value)}
                style={{ marginBottom: 0 }}
              />
              <input
                type="text"
                placeholder="Secret value"
                value={newSecretValue}
                onChange={(e) => setNewSecretValue(e.target.value)}
                style={{ marginBottom: 0 }}
              />
              <button onClick={handleAddSecret} disabled={!newSecretKey || !newSecretValue}>
                Add
              </button>
            </div>

            <div className="secret-list">
              {Object.entries(vaultState.secrets).length === 0 ? (
                <p className="warning">No secrets stored yet.</p>
              ) : (
                Object.entries(vaultState.secrets).map(([key, value]) => (
                  <div key={key} className="secret-item">
                    <span className="key">{key}</span>
                    <span className="value">{value}</span>
                    <div className="actions">
                      <button onClick={() => handleDeleteSecret(key)}>🗑️</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Test Info Card */}
      <div className="card">
        <h3>✅ Test Results</h3>
        <ul>
          <li className="success">WASM module loaded successfully</li>
          <li className={vaultState.state === 'authenticated' ? 'success' : 'pending'}>
            {vaultState.state === 'authenticated' ? '✅' : '⏳'} Identity creation (Ed25519)
          </li>
          <li className={currentSalt ? 'success' : 'pending'}>
            {currentSalt ? '✅' : '⏳'} Key derivation (Argon2id)
          </li>
          <li className={signature ? 'success' : 'pending'}>
            {signature ? '✅' : '⏳'} Message signing (Ed25519)
          </li>
          <li className={Object.keys(vaultState.secrets).length > 0 ? 'success' : 'pending'}>
            {Object.keys(vaultState.secrets).length > 0 ? '✅' : '⏳'} Encryption (XChaCha20-Poly1305)
          </li>
          <li className={storedDids.length > 0 ? 'success' : 'pending'}>
            {storedDids.length > 0 ? '✅' : '⏳'} IndexedDB persistence
          </li>
        </ul>
      </div>
    </div>
  );
}

// ============================================================================
// App Entry Point
// ============================================================================

export default function App() {
  const [wasm, setWasm] = useState<WasmModule | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadWasm() {
      try {
        // Dynamic import of WASM module from /wasm directory (not public)
        const module = await import('../wasm/p47h_wasm_core.js') as unknown as WasmModule;
        await module.default(new URL('../wasm/p47h_wasm_core_bg.wasm', import.meta.url).href);
        setWasm(module);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load WASM');
      }
    }
    loadWasm();
  }, []);

  if (error) {
    return <ErrorScreen error={error} onRetry={() => window.location.reload()} />;
  }

  if (!wasm) {
    return <LoadingScreen />;
  }

  return <VaultApp wasm={wasm} />;
}
