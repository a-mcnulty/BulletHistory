import { useEffect } from 'react';
import { useHistoryStore } from './store';

/**
 * Main application component
 * This is the entry point for the panel UI
 */
export default function App() {
  const { isLoading, error, fetchHistory } = useHistoryStore();

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (isLoading) {
    return (
      <div className="app loading">
        <div className="loading-spinner" />
        <p>Loading history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app error">
        <p>Error loading history: {error}</p>
        <button onClick={() => fetchHistory()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Bullet History</h1>
      </header>
      <main className="app-main">
        {/* Grid and expanded view components will be added here */}
        <p>Panel UI migration in progress...</p>
      </main>
      <footer className="app-footer">
        {/* Bottom menu will be added here */}
      </footer>
    </div>
  );
}
