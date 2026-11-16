import { useMutation, useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { lazy, Suspense, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api-client/client'
import { Tabs } from '../../components/Tabs'
import { Badge, ErrorNote, PageHeader } from '../../components/ui'
import { toast } from '../../lib/toast'

// Swagger UI is large; it is fetched only when the API reference tab is opened.
const ApiReference = lazy(() => import('./ApiReference'))

const PLATFORMS: Record<string, string> = {
  linux_amd64: 'Linux (x86-64)',
  linux_arm64: 'Linux (ARM64)',
  darwin_arm64: 'macOS (Apple silicon)',
  darwin_amd64: 'macOS (Intel)',
  windows_amd64: 'Windows (x86-64)',
}

/** The build most likely to suit the machine the console is open on. */
function likelyPlatform() {
  const ua = navigator.userAgent
  if (/Windows/i.test(ua)) return 'windows_amd64'
  if (/Mac/i.test(ua)) return 'darwin_arm64'
  return /aarch64|arm64/i.test(ua) ? 'linux_arm64' : 'linux_amd64'
}

function Code({ children }: { children: ReactNode }) {
  return <pre className="overflow-auto rounded-md border border-border bg-hover p-3 font-mono text-xs leading-5">{children}</pre>
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{n}</span>
      <div className="min-w-0 flex-1 space-y-2">
        <h3 className="font-medium">{title}</h3>
        {children}
      </div>
    </li>
  )
}

const APPLY_EXAMPLE = `# fleet.yaml
kind: Config
name: linux-hosts
description: Host metrics for Linux servers
bodyFile: linux-hosts.collector.yaml   # or inline:  body: |
---
kind: Group
name: prod-sre
selector:
  env: [prod]
  team: [sre]`

/** How to get and use opampctl: download, connect, everyday commands, and the tool's own usage text. */
function CommandLineTool() {
  const cli = useQuery({ queryKey: ['cli'], queryFn: api.cli, staleTime: 5 * 60_000 })
  const get = useMutation({ mutationFn: api.downloadCli, onError: (e) => toast({ title: 'Download failed', body: e.message, tone: 'danger' }) })
  if (cli.error) return <ErrorNote error={cli.error} />
  if (!cli.data) return <p className="text-muted">Loading…</p>
  const likely = likelyPlatform()
  const builds = [...cli.data.builds].sort((a, b) => Number(b.platform === likely) - Number(a.platform === likely))
  const origin = window.location.origin
  return (
    <div className="space-y-4">
      <p className="max-w-4xl text-xs text-muted">
        <code className="font-mono">opampctl</code> does from a terminal or a CI pipeline what the console does: list collectors, keep configs and groups in
        files and apply them, start and watch bulk pushes. It talks to the same API as the console, with a console API token.
      </p>
      <section className="card p-4">
        <ol className="space-y-5">
          <Step n={1} title={`Download opampctl ${cli.data.version}`}>
            {builds.length === 0 ? (
              <p className="text-xs text-muted">
                This deployment does not ship the downloads. Build the tool from the backend repository with <code className="font-mono">make build</code> (it
                is written to <code className="font-mono">bin/opampctl</code>), or <code className="font-mono">make cli-dist</code> to offer it here.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {builds.map((b) => (
                    <button key={b.platform} className={b.platform === likely ? 'btn btn-primary' : 'btn'} disabled={get.isPending} onClick={() => get.mutate(b.platform)}>
                      <Download size={13} /> {PLATFORMS[b.platform] ?? b.platform}
                    </button>
                  ))}
                </div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted">SHA-256 checksums</summary>
                  <ul className="mt-1 space-y-0.5 font-mono">
                    {builds.map((b) => (
                      <li key={b.platform} className="break-all">
                        {b.sha256} {b.file} <span className="text-muted">({(b.size / 1_048_576).toFixed(1)} MB)</span>
                      </li>
                    ))}
                  </ul>
                </details>
                <Code>{`chmod +x opampctl && sudo mv opampctl /usr/local/bin/\nopampctl version`}</Code>
                <p className="text-xs text-muted">On macOS, a downloaded binary may need: <code className="font-mono">xattr -d com.apple.quarantine opampctl</code></p>
              </>
            )}
          </Step>
          <Step n={2} title="Create an API token">
            <p className="text-xs text-muted">
              An administrator creates one under{' '}
              <Link to="/credentials?tab=tokens" className="text-accent hover:underline">
                Agent credentials → Console API tokens
              </Link>
              . Give it the role the job needs (viewer to look, operator to apply and push) and the project it acts in. The token is shown once.
            </p>
          </Step>
          <Step n={3} title="Point the tool at this console">
            <Code>{`export OPAMP_URL=${origin}\nexport OPAMP_TOKEN=opamp_pat_...\nexport OPAMP_PROJECT=<project name>     # needed to create or push anything\n\nopampctl agents`}</Code>
          </Step>
          <Step n={4} title="Everyday use">
            <Code>
              {`opampctl agents --selector env=prod,region=eu-west-1     # collectors matching attributes or labels\nopampctl config linux-hosts@3                            # print a config version's YAML\nopampctl apply -f fleet/ --dry-run                       # show what would change\nopampctl apply -f fleet/                                 # create or update configs and groups\nopampctl push --config linux-hosts --group prod-sre --batch-size 20 --wait\nopampctl rollout <id> pause                              # pause, resume, abort or rollback a push`}
            </Code>
            <p className="text-xs text-muted">
              <code className="font-mono">apply</code> reads YAML files like the one below. It never deletes anything and never pushes to collectors; running it
              twice changes nothing the second time, which makes it safe in a pipeline. <code className="font-mono">push --wait</code> exits 2 unless the push
              completes.
            </p>
            <Code>{APPLY_EXAMPLE}</Code>
          </Step>
        </ol>
      </section>
      <section className="card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <h2 className="font-medium">Reference</h2>
          <Badge tone="neutral">opampctl help</Badge>
        </div>
        <pre className="overflow-auto p-4 font-mono text-xs leading-5">{cli.data.usage}</pre>
      </section>
    </div>
  )
}

/** For people automating the console: the command-line tool and the API reference. */
export function Developer() {
  return (
    <div className="space-y-4">
      <PageHeader title="API and CLI" description="For automation: the opampctl command-line tool, and a reference to the API behind the console." />
      <Tabs
        label="API and CLI"
        tabs={[
          { value: 'cli', label: 'Command-line tool', content: <CommandLineTool /> },
          {
            value: 'api',
            label: 'API reference',
            content: (
              <>
                <p className="max-w-4xl text-xs text-muted">
                  Every endpoint, with its parameters, who may call it and an example request. "Try it out" sends real requests as you, with your role: a
                  request that changes something does change it.
                </p>
                <Suspense fallback={<p className="text-muted">Loading the API reference…</p>}>
                  <ApiReference />
                </Suspense>
              </>
            ),
          },
        ]}
      />
    </div>
  )
}
