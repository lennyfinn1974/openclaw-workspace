'use client';

import { Component, type ReactNode } from 'react';
import { ArenaDashboard } from '@/components/arena/ArenaDashboard';

class ArenaErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Arena Error</h1>
          <pre className="bg-gray-900 p-4 rounded-lg text-sm text-red-300 whitespace-pre-wrap break-words">
            {this.state.error.message}
          </pre>
          <pre className="bg-gray-900 p-4 rounded-lg text-xs text-gray-500 mt-4 whitespace-pre-wrap break-words max-h-96 overflow-auto">
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-4 px-4 py-2 bg-indigo-600 rounded-lg text-sm hover:bg-indigo-500"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ArenaPage() {
  return (
    <ArenaErrorBoundary>
      <ArenaDashboard />
    </ArenaErrorBoundary>
  );
}
