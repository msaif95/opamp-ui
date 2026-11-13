import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Catches render errors so a bug in one page shows a message instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="card max-w-lg space-y-3 p-6">
          <h1 className="text-base font-semibold">Something went wrong</h1>
          <p className="text-muted">The page hit an unexpected error. Your data is not affected. Reloading usually fixes it.</p>
          <pre className="overflow-auto rounded bg-panel-2 p-2 font-mono text-xs text-danger">{this.state.error.message}</pre>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    )
  }
}
