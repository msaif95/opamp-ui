import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, ApiError, type ConfigTemplate, type DerivedUpdate } from '../../api-client/client'
import { Badge } from '../../components/ui'
import { IssueList, YamlEditor } from './parts'
import type { useMerged } from './useMerged'

const OVERRIDES_HELP = (
  <>
    Write only what differs from the base, laid out like the config itself. Settings are merged key by key; a list (such as a pipeline's processors) replaces
    the base's list. Set a key to <code className="font-mono">~</code> to remove it, and write <code className="font-mono">{'{}'}</code> for a component with
    no settings.
  </>
)

/** The editor of a derived config: its overrides, and under them the config they produce. */
export function OverridesEditor({
  baseName,
  overrides,
  onChange,
  readOnly,
  project,
  merged,
  result,
}: {
  baseName: string
  overrides: string
  onChange: (text: string) => void
  readOnly?: boolean
  project: string | null
  /** The live merge, while the overrides are being edited. */
  merged?: ReturnType<typeof useMerged>
  /** The resulting config to show: the live merge's, or a saved version's. */
  result: string
}) {
  const failed = merged?.error
  return (
    <div>
      <div className="border-b border-border px-4 py-2">
        <h3 className="text-xs font-medium">Overrides on {baseName}</h3>
        {!readOnly && <p className="mt-0.5 max-w-4xl text-xs text-muted">{OVERRIDES_HELP}</p>}
      </div>
      <YamlEditor value={overrides} onChange={onChange} readOnly={readOnly} project={project} />
      <div className="border-y border-border px-4 py-2">
        <h3 className="text-xs font-medium">
          Resulting config {merged?.isFetching && <span className="ml-2 font-normal text-muted">working it out…</span>}
        </h3>
        <p className="mt-0.5 text-xs text-muted">What collectors are sent: the base with the overrides applied. It cannot be edited here.</p>
      </div>
      {failed ? (
        <p className="p-4 text-xs text-danger">{failed instanceof ApiError ? failed.message : 'Could not work out the result.'}</p>
      ) : (
        <>
          {merged?.data && merged.data.issues.length > 0 && (
            <div className="border-b border-border px-4 py-2">
              <IssueList issues={merged.data.issues} />
            </div>
          )}
          <pre className="max-h-[28rem] overflow-auto p-4 font-mono text-xs leading-5" aria-label="Resulting config">
            {result || <span className="text-muted">Nothing yet.</span>}
          </pre>
        </>
      )}
    </div>
  )
}

/** On a base config's page: the configs derived from it, whether each is up to date, and a way to update them all. */
export function DerivedConfigs({ config, mayEdit }: { config: ConfigTemplate; mayEdit: boolean }) {
  const qc = useQueryClient()
  const update = useMutation({ mutationFn: () => api.updateDerivedConfigs(config.id), onSuccess: () => qc.invalidateQueries({ queryKey: ['configs'] }) })
  const derived = config.derived ?? []
  const behind = derived.filter((d) => !d.up_to_date).length
  const outcome = (d: { id: string }): DerivedUpdate | undefined => update.data?.results.find((r) => r.id === d.id)
  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div>
          <h2 className="font-medium">Derived configs</h2>
          <p className="text-xs text-muted">
            {derived.length === 0
              ? 'None yet. A derived config takes this config as its base and holds only what differs, for example per environment.'
              : 'Configs that take this one as their base. They do not follow it by themselves: updating makes a new version of each, which you then push like any change.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mayEdit && behind > 0 && (
            <button className="btn" disabled={update.isPending} onClick={() => update.mutate()}>
              {update.isPending ? 'Updating…' : `Update ${behind} from v${config.latest_version}`}
            </button>
          )}
          {mayEdit && (
            <Link to={`/configs/new?base=${config.id}`} className="btn">
              New derived config
            </Link>
          )}
        </div>
      </div>
      {update.error && <p className="px-4 py-2 text-xs text-danger">{update.error.message}</p>}
      {derived.length > 0 && (
        <ul className="divide-y divide-border">
          {derived.map((d) => {
            const done = outcome(d)
            return (
              <li key={d.id} className="px-4 py-2">
                <div className="flex flex-wrap items-center gap-3">
                  <Link to={`/configs/${d.id}`} className="font-medium text-accent hover:underline">
                    {d.name}
                  </Link>
                  <span className="text-xs text-muted">
                    v{d.latest_version}, built from v{d.base_version} of this config
                  </span>
                  {d.up_to_date ? <Badge tone="success">Up to date</Badge> : <Badge tone="warning">Behind</Badge>}
                  {done && done.version > 0 && <span className="text-xs text-success">Updated: now v{done.version}. Push it to its collectors when ready.</span>}
                </div>
                {done?.error && (
                  <div className="mt-1 text-xs">
                    <p className="text-danger">Not updated: {done.error}. Change its overrides to suit the new base.</p>
                    {done.issues && <IssueList issues={done.issues} />}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
