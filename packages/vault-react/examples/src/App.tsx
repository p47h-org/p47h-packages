import { useState } from 'react';
import { 
  P47hProvider, 
  useP47h, 
  useIdentity, 
  useSecret 
} from '@p47h/vault-react';

// ============================================================================
// Loading Fallback Component
// ============================================================================

function LoadingFallback({ elapsedMs }: { elapsedMs: number }) {
  const seconds = Math.floor(elapsedMs / 1000);
  
  return (
    <div className="container">
      <h1>🔐 P47H Vault React</h1>
      <div className="card">
        <h3>⚡ Initializing WASM...</h3>
        <div className="flex-row">
          <div className="loading-spinner" />
          <span>Loading cryptographic core... ({seconds}s)</span>
        </div>
        {elapsedMs > 5000 && (
          <p className="warning mt-2">
            This is taking longer than usual. Please wait...
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Error Fallback Component
// ============================================================================

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="container">
      <h1>🔐 P47H Vault React</h1>
      <div className="card">
        <h3 className="error">❌ Initialization Error</h3>
        <pre>{error.message}</pre>
        <button onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ state }: { state: string }) {
  const stateClass = state === 'unlocked' ? 'unlocked' : state === 'locked' ? 'locked' : state;
  return <span className={`status-badge ${stateClass}`}>{stateClass}</span>;
}

// ============================================================================
// Auth Panel Component (uses useIdentity hook)
// ============================================================================

function AuthPanel() {
  const { state, did, isAuthenticated, storedIdentities } = useP47h();
  const { register, login, logout, isLoading, error } = useIdentity();
  const [password, setPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!password) return;
    try {
      const result = await register(password);
      setRecoveryCode(result.recoveryCode);
      setPassword('');
    } catch {
      // Error handled by useIdentity
    }
  };

  const handleLogin = async () => {
    if (!password) return;
    try {
      await login(password);
      setPassword('');
    } catch {
      // Error handled by useIdentity
    }
  };

  const handleLogout = () => {
    logout();
    setPassword('');
    setRecoveryCode(null);
  };

  return (
    <div className="card">
      <h3>🔑 Authentication</h3>
      
      <div className="flex-row mb-2">
        <span>Status:</span>
        <StatusBadge state={state} />
        {storedIdentities.length > 0 && !isAuthenticated && (
          <span className="info" style={{ marginLeft: '10px' }}>
            ({storedIdentities.length} stored {storedIdentities.length === 1 ? 'identity' : 'identities'})
          </span>
        )}
      </div>

      {did && (
        <div className="mb-2">
          <span className="info">DID:</span>
          <pre style={{ fontSize: '11px' }}>{did}</pre>
        </div>
      )}

      {recoveryCode && (
        <div className="mb-2" style={{ background: '#ff475722', padding: '12px', borderRadius: '8px' }}>
          <strong className="warning">⚠️ Save your Recovery Code:</strong>
          <pre style={{ fontSize: '12px', wordBreak: 'break-all' }}>{recoveryCode}</pre>
          <small className="warning">This is shown only once. Save it securely!</small>
        </div>
      )}

      {error && (
        <div className="error mb-2">❌ {error.message}</div>
      )}

      {!isAuthenticated ? (
        <>
          <input
            type="password"
            placeholder={storedIdentities.length > 0 ? "Enter password to unlock" : "Create password for new identity"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (storedIdentities.length > 0 ? handleLogin() : handleRegister())}
            disabled={isLoading}
          />
          <div className="flex-row">
            {storedIdentities.length > 0 ? (
              <>
                <button onClick={handleLogin} disabled={isLoading || !password}>
                  {isLoading ? 'Unlocking...' : '🔓 Unlock Vault'}
                </button>
                <button onClick={handleRegister} disabled={isLoading || !password}>
                  🆕 New Identity
                </button>
              </>
            ) : (
              <button onClick={handleRegister} disabled={isLoading || !password}>
                {isLoading ? 'Creating...' : '🆕 Create New Identity'}
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="flex-row">
          <button onClick={handleLogout}>🔒 Lock Vault</button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Secret Item Component (uses useSecret hook)
// ============================================================================

function SecretItem({ secretKey, onRemove }: { secretKey: string; onRemove: () => void }) {
  const { value, set, status, exists } = useSecret(secretKey);
  const [editValue, setEditValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const startEdit = () => {
    setEditValue(value ?? '');
    setIsEditing(true);
  };

  const saveEdit = () => {
    set(editValue);
    setIsEditing(false);
  };

  const deleteSecret = () => {
    set('');
  };

  return (
    <div className="secret-item">
      <span className="key">{secretKey}</span>
      
      {status === 'loading' ? (
        <span className="value pending">Loading...</span>
      ) : isEditing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
          onBlur={saveEdit}
          autoFocus
          style={{ marginBottom: 0, flex: 2 }}
        />
      ) : (
        <span className="value" onClick={startEdit} style={{ cursor: 'pointer' }}>
          {exists && value ? value : <em className="warning">empty</em>}
        </span>
      )}
      
      <div className="actions">
        {!isEditing && (
          <>
            <button onClick={startEdit}>✏️</button>
            <button onClick={deleteSecret}>🗑️</button>
            <button onClick={onRemove} title="Remove from list">✕</button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Secrets Panel Component
// ============================================================================

function SecretsPanel() {
  const { isAuthenticated } = useP47h();
  const [newKey, setNewKey] = useState('');
  const [activeSecrets, setActiveSecrets] = useState<string[]>(['api_key', 'note']);

  const addSecret = () => {
    if (newKey && !activeSecrets.includes(newKey)) {
      setActiveSecrets([...activeSecrets, newKey]);
      setNewKey('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="card">
        <h3>📦 Secrets</h3>
        <p className="warning">🔒 Vault is locked. Login to manage secrets.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>📦 Secrets (persisted in IndexedDB)</h3>
      
      <div className="flex-row mb-2">
        <input
          type="text"
          placeholder="New secret key..."
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addSecret()}
          style={{ marginBottom: 0 }}
        />
        <button onClick={addSecret} disabled={!newKey}>
          Add
        </button>
      </div>

      <div className="secret-list">
        {activeSecrets.map((key) => (
          <SecretItem 
            key={key} 
            secretKey={key}
            onRemove={() => setActiveSecrets(activeSecrets.filter(k => k !== key))}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Info Panel Component
// ============================================================================

function InfoPanel() {
  const { state, storedIdentities, isAuthenticated } = useP47h();
  
  return (
    <div className="card">
      <h3>✅ DX Features Test</h3>
      <ul>
        <li className="success">✅ WASM auto-loading via P47hProvider</li>
        <li className={storedIdentities.length > 0 ? 'success' : 'pending'}>
          {storedIdentities.length > 0 ? '✅' : '⏳'} IndexedDB persistence (auto-detect identities)
        </li>
        <li className={state === 'locked' ? 'success' : 'pending'}>
          {state === 'locked' ? '✅' : '⏳'} Auto-lock state on page reload
        </li>
        <li className={isAuthenticated ? 'success' : 'pending'}>
          {isAuthenticated ? '✅' : '⏳'} Session management (unlock/lock)
        </li>
        <li className="success">✅ useIdentity hook (register, login, logout)</li>
        <li className="success">✅ useSecret hook (encrypted CRUD)</li>
        <li className="success">✅ React Strict Mode compatible</li>
      </ul>
      <p className="info mt-2">
        <strong>DX:</strong> Developers just wrap their app with <code>&lt;P47hProvider&gt;</code> 
        and use hooks. All persistence, encryption, and WASM loading is handled automatically.
      </p>
    </div>
  );
}

// ============================================================================
// Main App Component
// ============================================================================

function VaultApp() {
  return (
    <div className="container">
      <h1>🔐 P47H Vault React</h1>
      <h2>Testing @p47h/vault-react v0.10.0 with real persistence</h2>
      
      <AuthPanel />
      <SecretsPanel />
      <InfoPanel />
    </div>
  );
}

// ============================================================================
// App with Provider - This is ALL the developer needs to do!
// ============================================================================

export default function App() {
  return (
    <P47hProvider
      config={{
        wasmPath: '/wasm/p47h_wasm_core.wasm',
      }}
      fallback={(elapsed) => <LoadingFallback elapsedMs={elapsed as number} />}
      errorFallback={(error) => <ErrorFallback error={error as Error} />}
    >
      <VaultApp />
    </P47hProvider>
  );
}
