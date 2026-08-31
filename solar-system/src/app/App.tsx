import { Component, type ErrorInfo, type ReactNode } from 'react';

import { AppShell } from './AppShell';

export function App() {
  return (
    <ApplicationErrorBoundary>
      <AppShell />
    </ApplicationErrorBoundary>
  );
}
interface ApplicationErrorBoundaryProps {
  readonly children: ReactNode;
}
interface ApplicationErrorBoundaryState {
  readonly error: Error | null;
}

class ApplicationErrorBoundary extends Component<
  ApplicationErrorBoundaryProps,
  ApplicationErrorBoundaryState
> {
  public state: ApplicationErrorBoundaryState = { error: null };

  public static getDerivedStateFromError(error: Error): ApplicationErrorBoundaryState {
    return { error };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Solar System application boundary caught an error.', error, info);
  }

  public render(): ReactNode {
    if (this.state.error === null) {
      return this.props.children;
    }

    return (
      <main className="fatal-error" role="alert">
        <p className="eyebrow">Observatory offline</p>
        <h1>The simulation could not start</h1>
        <p>{this.state.error.message}</p>
        <button className="button button-primary" type="button" onClick={() => location.reload()}>
          Reload observatory
        </button>
      </main>
    );
  }
}
