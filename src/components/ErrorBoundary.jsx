import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-black">
          <div className="flex flex-col items-center gap-3 max-w-sm text-center px-6">
            <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-2xl">⚠️</div>
            <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">Something went wrong</p>
            <p className="text-xs text-gray-500 dark:text-zinc-400 font-mono break-all">
              {this.state.error.message}
            </p>
            <button
              className="text-sm font-medium px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
