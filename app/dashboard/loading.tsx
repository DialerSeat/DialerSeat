export default function DashboardLoading() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--brand-page-bg)',
      }}
    >
      <div
        style={{
          fontFamily: 'Futura, "Trebuchet MS", sans-serif',
          fontSize: 11,
          fontWeight: 'bold',
          letterSpacing: 4,
          color: 'var(--brand-primary)',
          animation: 'dsLoadPulse 1.1s ease-in-out infinite',
        }}
      >
        LOADING
      </div>
      <style>{`
        @keyframes dsLoadPulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
