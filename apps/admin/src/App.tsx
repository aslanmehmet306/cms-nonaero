import { UserRole } from '@airport-revenue/shared-types';

const roles = Object.values(UserRole);

export function App() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '48px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          maxWidth: '600px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '28px', color: '#111827', marginBottom: '8px' }}>
          Airport Revenue Management
        </h1>
        <h2 style={{ fontSize: '18px', color: '#6b7280', fontWeight: 400, marginBottom: '24px' }}>
          Admin Portal
        </h2>
        <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '32px' }}>
          Phase 1 - Foundation Complete
        </p>
        <div style={{ textAlign: 'left' }}>
          <h3 style={{ fontSize: '14px', color: '#374151', marginBottom: '12px' }}>
            Available Roles (from shared-types):
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {roles.map((role) => (
              <li
                key={role}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '6px',
                  marginBottom: '4px',
                  fontSize: '13px',
                  color: '#4b5563',
                  fontFamily: 'monospace',
                }}
              >
                {role}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
