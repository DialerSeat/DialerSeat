import type { RequestLogRow } from '@/lib/developers/store'
import { MethodPill } from '../ui'

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

export function RequestTable({ rows }: { rows: RequestLogRow[] }) {
  if (!rows.length) return <div className="dv-empty">No API requests yet. They appear here as soon as your server makes one.</div>
  return (
    <div className="dv-table-wrap">
      <table className="dv-table">
        <thead><tr><th>Method</th><th>Path</th><th>Status</th><th>Env</th><th>Time</th><th style={{ textAlign: 'right' }}>When</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td><MethodPill method={r.method} /></td>
              <td className="dv-mono" style={{ fontSize: 12.5 }}>{r.path}</td>
              <td><span className={`dv-badge ${r.status < 300 ? 'dv-badge-green' : r.status < 500 ? 'dv-badge-amber' : 'dv-badge-red'}`}>{r.status}</span></td>
              <td><span className={`dv-badge ${r.env === 'live' ? 'dv-badge-blue' : ''}`}>{r.env}</span></td>
              <td className="dv-dim">{r.duration_ms != null ? `${r.duration_ms} ms` : '—'}</td>
              <td className="dv-dim" style={{ textAlign: 'right' }}>{ago(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
