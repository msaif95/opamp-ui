import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { api } from '../../api-client/client'
import { Modal } from '../../components/Dialogs'
import { ErrorNote } from '../../components/ui'
import { timeAgo } from '../../lib/time'
import { TabIntro } from './Credentials'
import { confirmDialog } from '../../lib/dialog'

/** Paste a certificate to block it, in a dialog. */
function RevokeCert({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [pem, setPem] = useState('')
  const revoke = useMutation({
    mutationFn: () => api.revokeCert(name.trim(), pem.trim()),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['revoked-certs'] })
      onClose()
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void confirmDialog({
      title: 'Revoke this certificate?',
      body: 'An agent using it is disconnected within about 30 seconds and cannot reconnect. This cannot be undone here.',
      action: 'Revoke',
      danger: true,
    }).then((ok) => ok && revoke.mutate())
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-1">
        <span className="block text-xs text-muted">Label (optional; defaults to the certificate's common name)</span>
        <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block space-y-1">
        <span className="block text-xs text-muted">Certificate (PEM)</span>
        <textarea
          className="input h-40 w-full py-2 font-mono text-xs"
          value={pem}
          onChange={(e) => setPem(e.target.value)}
          placeholder="-----BEGIN CERTIFICATE-----"
          spellCheck={false}
          autoFocus
        />
      </label>
      {revoke.error && <p className="text-xs text-danger">{revoke.error.message}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-danger" disabled={!pem.trim() || revoke.isPending}>
          Revoke certificate
        </button>
      </div>
    </form>
  )
}

/** Blocks individual agent client certificates that would otherwise be trusted because they chain to the CA. */
export function RevokedCerts() {
  const [revoking, setRevoking] = useState(false)
  const certs = useQuery({ queryKey: ['revoked-certs'], queryFn: api.revokedCerts })

  return (
    <section className="space-y-4">
      <TabIntro
        text={
          <>
            Any certificate issued by the trusted CA can connect. Revoke one certificate to block it, for example after a host is
            compromised.
          </>
        }
        action={
          <button className="btn btn-primary" onClick={() => setRevoking(true)}>
          <Plus size={14} /> Revoke a certificate
        </button>
        }
      />
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
      <Modal open={revoking} onClose={() => setRevoking(false)} size="lg" title="Revoke a client certificate">
        {revoking && <RevokeCert onClose={() => setRevoking(false)} />}
      </Modal>
    </section>
  )
}
