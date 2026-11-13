import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api-client/client'

const platforms = [
  { value: 'linux_amd64', label: 'Linux (x86-64)' },
  { value: 'linux_arm64', label: 'Linux (ARM64)' },
  { value: 'darwin_arm64', label: 'macOS (Apple silicon)' },
  { value: 'darwin_amd64', label: 'macOS (Intel)' },
]

/** Generates a one-off install script for the stock OpenTelemetry Collector and OpAMP Supervisor. */
export function InstallCollector() {
  const qc = useQueryClient()
  // Start on the platform of the machine the console is open on; servers are usually Linux, so that is the fallback.
  const [platform, setPlatform] = useState(() => (/Mac/i.test(navigator.userAgent) ? 'darwin_arm64' : 'linux_amd64'))
  const [version, setVersion] = useState('0.164.0')
  const [keyName, setKeyName] = useState('')
  const [expiresDays, setExpiresDays] = useState('0')
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [labelText, setLabelText] = useState('')
  const [labelError, setLabelError] = useState(false)
  const [copied, setCopied] = useState(false)

  const generate = useMutation({
    mutationFn: () => api.installCommand({ platform, version: version.trim(), labels, key_name: keyName.trim(), expires_days: Number(expiresDays) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })

  const addLabel = (e: FormEvent) => {
    e.preventDefault()
    const i = labelText.indexOf('=')
    if (i <= 0 || i === labelText.length - 1) return setLabelError(true)
    setLabels({ ...labels, [labelText.slice(0, i).trim()]: labelText.slice(i + 1).trim() })
    setLabelText('')
    setLabelError(false)
  }
  const copy = async () => {
    await navigator.clipboard.writeText(generate.data?.script ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-4xl space-y-4">
      <Link to="/agents" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
        <ArrowLeft size={13} /> Fleet
      </Link>
      <div>
        <h1 className="text-lg font-semibold">Add collectors</h1>
        <p className="text-xs text-muted">
          Generates a script that installs the standard OpenTelemetry Collector (contrib) with the OpAMP Supervisor, already connected to
          this console. Run it on each host; the labels decide which groups the collectors fall into.
        </p>
      </div>

      <section className="card space-y-4 p-4">
        <div className="flex flex-wrap gap-3">
          <label className="space-y-1">
            <span className="block text-xs text-muted">Platform</span>
            <select className="input w-52" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {platforms.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-muted">Collector version</span>
            <input className="input w-32" value={version} onChange={(e) => setVersion(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-muted">Name for the API key this creates</span>
            <input className="input w-64" value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g. iad1-prod-collectors" />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-muted">Key expires in (days, 0 = never)</span>
            <input className="input w-40" type="number" min={0} value={expiresDays} onChange={(e) => setExpiresDays(e.target.value)} />
          </label>
        </div>

        <div className="space-y-2">
          <span className="block text-xs text-muted">Labels (for example env=prod, region=us-east-1, team=sre)</span>
          <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={addLabel}>
              <input
                className={`input w-56 ${labelError ? 'border-danger' : ''}`}
                placeholder="key=value, then Enter"
                value={labelText}
                onChange={(e) => setLabelText(e.target.value)}
                aria-label="Add label"
              />
            </form>
            {Object.entries(labels).map(([k, v]) => (
              <span key={k} className="chip">
                {k}={v}
                <button onClick={() => setLabels(Object.fromEntries(Object.entries(labels).filter(([x]) => x !== k)))} aria-label={`Remove label ${k}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {generate.error && <p className="text-xs text-danger">{generate.error.message}</p>}
        <button className="btn btn-primary" disabled={!keyName.trim() || !version.trim() || generate.isPending} onClick={() => generate.mutate()}>
          Generate install script
        </button>
      </section>

      {generate.data && (
        <section className="card space-y-3 border-warning p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-medium">Install script</h2>
              <p className="text-xs text-muted">
                For {platforms.find((p) => p.value === platform)?.label}. It contains a new agent API key and is shown only once: copy it
                now. Run it with sudo to install a service that starts at boot.
                Revoke the key under Agent credentials to cut off every collector installed with it.
              </p>
            </div>
            <button className="btn shrink-0" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="max-h-96 overflow-auto rounded bg-panel-2 p-3 font-mono text-xs">{generate.data.script}</pre>
        </section>
      )}
    </div>
  )
}
