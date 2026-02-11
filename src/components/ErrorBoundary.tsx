import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h1>Something went wrong</h1>
          <p>{this.state.error?.message || 'Unknown error'}</p>
          <p style={{ fontSize: '12px', color: '#666' }}>
            Check the browser console for more details.
            {this.state.error?.message?.includes('Supabase') && (
              <div>
                <br />
                <strong>Missing environment variables?</strong>
                <br />
                Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in Vercel.
              </div>
            )}
          </p>
        </div>
      )
    }

    return this.props.children
  }
}
