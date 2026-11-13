import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api } from '../../api-client/client'
import { ErrorNote } from '../../components/ui'
import { timeAgo } from '../../lib/time'
import { confirmDialog } from '../../lib/dialog'

/** Blocks individual agent client certificates that would otherwise be trusted because they chain to the CA. */
export function RevokedCerts() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [pem, setPem] = useState('')

  const certs = useQuery({ queryKey: ['revoked-certs'], queryFn: api.revokedCerts })
  const revoke = useMutation({
    mutationFn: () => api.revokeCert(name.trim(), pem.trim()),
    onSuccess: () => {
      setName('')
      setPem('')
      return qc.invalidateQueries({ queryKey: ['revoked-certs'] })
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void confirmDialog('Revoke this certificate? An agent using it is disconnected within about 30 seconds and cannot reconnect. This cannot be undone here.').then((ok) => ok && revoke.mutate())
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Revoked client certificates</h2>
        <p className="text-xs text-muted">
          Any certificate issued by the trusted CA can connect. Paste a certificate here to block that one certificate, for example after a
          host is compromised.
        </p>
      </div>
      <form onSubmit={submit} className="card space-y-3 p-4">
        <label className="block space-y-1">
          <span className="block text-xs text-muted">Label (optional; defaults to the certificate's common name)</span>
          <input className="input w-64" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="block text-xs text-muted">Certificate (PEM)</span>
          <textarea
            className="input h-28 w-full py-2 font-mono text-xs"
            value={pem}
            onChange={(e) => setPem(e.target.value)}
            placeholder="-----BEGIN CERTIFICATE-----"
            spellCheck={false}
          />
        </label>
        <div className="flex items-center gap-3">
          <button className="btn btn-danger" disabled={!pem.trim() || revoke.isPending}>
            Revoke certificate
          </button>
          {revoke.error && <span className="text-xs text-danger">{revoke.error.message}</span>}
        </div>
      </form>
      <div className="card overflow-auto">
        {certs.error ? (
          <ErrorNote error={certs.error} />
        ) : (
          <table className="table dense">
            <thead>
              <tr>
                <th>Label</th>
                <th>Subject</th>
                <th>SHA-256 fingerprint</th>
                <th>Revoked by</th>
                <th>Revoked</th>
              </tr>
            </thead>
            <tbody>
              {certs.data?.revoked_certs.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.subject}</td>
                  <td className="font-mono text-xs">{c.fingerprint_sha256}</td>
                  <td>{c.revoked_by}</td>
                  <td className="text-muted">{timeAgo(c.revoked_at)}</td>
                </tr>
              ))}
              {certs.data?.revoked_certs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">
                    No certificates revoked.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
