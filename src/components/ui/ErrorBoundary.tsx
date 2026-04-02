import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Sentry } from '@/lib/sentry';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <div className="text-center">
            <h2 className="mb-2 text-xl font-bold text-danger">Something went wrong</h2>
            <p className="mb-4 text-sm text-content-secondary">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <Button onClick={this.handleRetry}>Try Again</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
