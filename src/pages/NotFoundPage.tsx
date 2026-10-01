export function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '3rem',
            fontWeight: 600,
            color: 'var(--brass-600)',
            lineHeight: 1,
          }}
        >
          404
        </p>
        <h1 style={{ marginTop: 10 }}>Page not found</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 8, maxWidth: '46ch' }}>
          The page you were looking for does not exist or has been moved.
        </p>
        <a
          href="/dashboard"
          className="btn btn--primary"
          style={{ marginTop: 20, display: 'inline-flex' }}
        >
          Return to dashboard
        </a>
      </div>
    </div>
  )
}