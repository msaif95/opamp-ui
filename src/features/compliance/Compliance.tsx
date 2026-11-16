import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Download, FileCheck2, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { api, type ComplianceReport, type ReportFormat, type ReportFrequency } from '../../api-client/client'
import { Modal } from '../../components/Dialogs'
import { EmptyState } from '../../components/EmptyState'
import { Select } from '../../components/Select'
import { Tabs } from '../../components/Tabs'
import { Badge, ErrorNote, PageHeader } from '../../components/ui'
import { confirmDialog } from '../../lib/dialog'
import { timeAgo } from '../../lib/time'
import { toast } from '../../lib/toast'
import { AuditLog } from '../audit-log/AuditLog'
import { TabIntro } from '../credentials/Credentials'

const day = (t: string) => new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
const when = (t: string) => new Date(t).toLocaleString()

const PERIODS = [
  { value: '1', label: 'Last 24 hours' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 365 days' },
]
const FREQUENCIES: { value: ReportFrequency; label: string; hint: string }[] = [
  { value: 'daily', label: 'Daily', hint: 'Each day, covering the day before' },
  { value: 'weekly', label: 'Weekly', hint: 'Each Monday, covering Monday to Sunday before' },
  { value: 'monthly', label: 'Monthly', hint: 'On the 1st, covering the month before' },
]
const FORMATS: { format: ReportFormat; label: string; hint: string }[] = [
  { format: 'html', label: 'Printable report (HTML)', hint: 'Open it and print to PDF' },
  { format: 'collectors', label: 'Fleet snapshot (CSV)', hint: 'One row per collector' },
  { format: 'changes', label: 'Change trail (CSV)', hint: 'One row per audit event' },
  { format: 'json', label: 'Everything (JSON)', hint: 'For other tools' },
]

function NewReport({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [days, setDays] = useState('30')
  const create = useMutation({
    mutationFn: () => api.createReport(name.trim(), Number(days)),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ['reports'] })
      toast({ title: `Report "${r.name}" is ready`, tone: 'success' })
      onClose()
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate()
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-1">
        <span className="block text-xs text-muted">Changes to include</span>
        <Select className="w-full" value={days} onChange={setDays} options={PERIODS} aria-label="Period" />
      </label>
      <label className="block space-y-1">
        <span className="block text-xs text-muted">Name (optional)</span>
        <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q4 audit preparation" autoFocus />
      </label>
      <p className="text-xs text-muted">The fleet's state is recorded as it is right now; the change trail covers the period chosen.</p>
      {create.error && <p className="text-xs text-danger">{create.error.message}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={create.isPending}>
          {create.isPending ? 'Generating…' : 'Generate report'}
        </button>
      </div>
    </form>
  )
}

function NewSchedule({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState<ReportFrequency>('monthly')
  const create = useMutation({
    mutationFn: () => api.createReportSchedule(name.trim(), frequency),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['report-schedules'] })
      onClose()
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate()
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-1">
        <span className="block text-xs text-muted">Name</span>
        <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly compliance review" autoFocus />
      </label>
      <label className="block space-y-1">
        <span className="block text-xs text-muted">How often</span>
        <Select className="w-full" value={frequency} onChange={(v) => setFrequency(v as ReportFrequency)} options={FREQUENCIES} aria-label="How often" />
      </label>
      <p className="text-xs text-muted">Periods are whole days, weeks and months in UTC. The first report is made when the current period ends.</p>
      {create.error && <p className="text-xs text-danger">{create.error.message}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={!name.trim() || create.isPending}>
          Create schedule
        </button>
      </div>
    </form>
  )
}

function Downloads({ report }: { report: ComplianceReport }) {
  const get = useMutation({ mutationFn: (format: ReportFormat) => api.downloadReport(report.id, format), onError: (e) => toast({ title: 'Download failed', body: e.message, tone: 'danger' }) })
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="btn btn-sm" disabled={get.isPending} aria-label={`Download ${report.name}`}>
        <Download size={12} /> {get.isPending ? 'Preparing…' : 'Download'}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-60 rounded-md border border-border bg-panel p-1 shadow-lg">
          {FORMATS.map((f) => (
            <DropdownMenu.Item
              key={f.format}
              className="cursor-default select-none rounded px-2 py-1.5 outline-none data-[highlighted]:bg-accent-soft data-[highlighted]:text-accent"
              onSelect={() => get.mutate(f.format)}
            >
              <div className="text-[13px]">{f.label}</div>
              <div className="text-xs text-muted">{f.hint}</div>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function Reports() {
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const reports = useQuery({ queryKey: ['reports'], queryFn: api.reports, refetchInterval: 60_000 })
  const remove = useMutation({ mutationFn: api.deleteReport, onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }) })
  const rows = reports.data?.reports ?? []
  const newButton = (
    <button className="btn btn-primary" onClick={() => setCreating(true)}>
      <Plus size={14} /> Generate report
    </button>
  )
  return (
    <section className="space-y-4">
      <TabIntro
        text="Each report records the state of every collector at the moment it was made, the trail of changes over its period taken from the audit log, and whether the audit log itself verified as unaltered. Reports are kept as they were made."
        action={newButton}
      />
      {reports.error ? (
        <ErrorNote error={reports.error} />
      ) : reports.data && rows.length === 0 ? (
        <EmptyState icon={FileCheck2} title="No reports yet" action={newButton}>
          <p>Generate one now, or set up a schedule to have one made every day, week or month.</p>
        </EmptyState>
      ) : (
        <div className="card overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Period (UTC)</th>
                <th>Fleet</th>
                <th>Changes</th>
                <th>Audit log</th>
                <th>Generated</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.name}</td>
                  <td className="whitespace-nowrap">
                    {day(r.period_from)} – {day(r.period_to)}
                  </td>
                  <td>
                    {r.summary.collectors.toLocaleString()} collectors
                    <div className="text-xs text-muted">
                      {r.summary.connected.toLocaleString()} connected · {r.summary.in_sync.toLocaleString()} of {r.summary.with_config.toLocaleString()} on their config
                      {r.summary.config_failed > 0 && <span className="text-danger"> · {r.summary.config_failed.toLocaleString()} failed</span>}
                    </div>
                  </td>
                  <td>
                    {r.summary.changes.toLocaleString()}
                    <div className="text-xs text-muted">
                      {r.summary.config_changes.toLocaleString()} config · {r.summary.pushes.toLocaleString()} pushes · {r.summary.access_changes.toLocaleString()} access
                      {r.summary.removed > 0 && ` · ${r.summary.removed.toLocaleString()} removed`}
                    </div>
                  </td>
                  <td>{r.summary.audit_intact ? <Badge tone="success">Intact</Badge> : <Badge tone="danger">Not intact</Badge>}</td>
                  <td>
                    <span title={when(r.generated_at)}>{timeAgo(r.generated_at)}</span>
                    <div className="text-xs text-muted">{r.generated_by}</div>
                  </td>
                  <td className="space-x-2 whitespace-nowrap text-right">
                    <Downloads report={r} />
                    <button
                      className="btn btn-sm btn-danger"
                      disabled={remove.isPending}
                      onClick={() => {
                        void confirmDialog(`Delete the report "${r.name}"? The audit log it was made from is not affected.`).then((ok) => ok && remove.mutate(r.id))
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {remove.error && <ErrorNote error={remove.error} />}
      <Modal open={creating} onClose={() => setCreating(false)} title="Generate a compliance report">
        {creating && <NewReport onClose={() => setCreating(false)} />}
      </Modal>
    </section>
  )
}

function Schedules() {
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const schedules = useQuery({ queryKey: ['report-schedules'], queryFn: api.reportSchedules, refetchInterval: 60_000 })
  const refresh = () => qc.invalidateQueries({ queryKey: ['report-schedules'] })
  const toggle = useMutation({ mutationFn: (v: { id: string; enabled: boolean }) => api.setReportScheduleEnabled(v.id, v.enabled), onSuccess: refresh })
  const remove = useMutation({ mutationFn: api.deleteReportSchedule, onSuccess: refresh })
  const run = useMutation({
    mutationFn: api.runReportSchedule,
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ['reports'] })
      toast({ title: `Report "${r.name}" is ready`, body: 'It is on the Reports tab.', tone: 'success', to: '/audit?tab=reports' })
    },
  })
  const rows = schedules.data?.schedules ?? []
  const error = toggle.error ?? remove.error ?? run.error
  const newButton = (
    <button className="btn btn-primary" onClick={() => setCreating(true)}>
      <Plus size={14} /> New schedule
    </button>
  )
  return (
    <section className="space-y-4">
      <TabIntro
        text="A schedule makes a report for every whole day, week or month, shortly after the period ends. If an alert webhook is set up, it is told when each report is ready."
        action={newButton}
      />
      {schedules.error ? (
        <ErrorNote error={schedules.error} />
      ) : schedules.data && rows.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No schedules" action={newButton}>
          <p>Reports are only made when someone asks. Add a schedule to have them made regularly.</p>
        </EmptyState>
      ) : (
        <div className="card overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Schedule</th>
                <th>How often</th>
                <th>Status</th>
                <th>Next report</th>
                <th>Last report</th>
                <th>Created by</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td className="capitalize">{s.frequency}</td>
                  <td>{s.enabled ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Paused</Badge>}</td>
                  <td>{s.enabled ? when(s.next_run_at) : <span className="text-muted">–</span>}</td>
                  <td className="text-muted">{s.last_run_at ? timeAgo(s.last_run_at) : 'Never'}</td>
                  <td className="text-muted">{s.created_by}</td>
                  <td className="space-x-2 whitespace-nowrap text-right">
                    <button className="btn btn-sm" disabled={run.isPending} title="Make the report for the last whole period now" onClick={() => run.mutate(s.id)}>
                      Run now
                    </button>
                    <button className="btn btn-sm" disabled={toggle.isPending} onClick={() => toggle.mutate({ id: s.id, enabled: !s.enabled })}>
                      {s.enabled ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      disabled={remove.isPending}
                      onClick={() => {
                        void confirmDialog(`Delete the schedule "${s.name}"? Reports it already made are kept.`).then((ok) => ok && remove.mutate(s.id))
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && <ErrorNote error={error} />}
      <Modal open={creating} onClose={() => setCreating(false)} title="New report schedule">
        {creating && <NewSchedule onClose={() => setCreating(false)} />}
      </Modal>
    </section>
  )
}

/**
 * Audit and compliance in one place: the audit log itself, and the compliance reports made from it (fleet state
 * snapshots and the trail of changes), generated on request or on a schedule.
 */
export function Compliance() {
  return (
    <div className="space-y-4">
      <PageHeader title="Audit and compliance" description="The record of who changed what, and reports of it and of the fleet's state to hand to an auditor." />
      <Tabs
        label="Audit and compliance"
        tabs={[
          { value: 'log', label: 'Audit log', content: <AuditLog /> },
          { value: 'reports', label: 'Reports', content: <Reports /> },
          { value: 'schedules', label: 'Schedules', content: <Schedules /> },
        ]}
      />
    </div>
  )
}
