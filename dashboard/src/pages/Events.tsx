import { useState } from 'react';
import { useSSE } from '../hooks/useSSE';
import { AlertTriangle, Filter, Download, Trash2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

export default function Events() {
  const [filter, setFilter] = useState<{ severity?: string[] }>({});
  const { events, connected, clearEvents } = useSSE('/sse/events', filter);
  const [selectedSeverity, setSelectedSeverity] = useState<string[]>([]);

  const toggleSeverity = (severity: string) => {
    const newSelected = selectedSeverity.includes(severity)
      ? selectedSeverity.filter(s => s !== severity)
      : [...selectedSeverity, severity];

    setSelectedSeverity(newSelected);
    setFilter({ severity: newSelected.length > 0 ? newSelected : undefined });
  };

  const exportEvents = () => {
    const csv = [
      ['Timestamp', 'Type', 'Plugin', 'Severity', 'Source', 'Data'].join(','),
      ...events.map(e => [
        format(e.timestamp, 'yyyy-MM-dd HH:mm:ss'),
        e.type,
        e.pluginId,
        e.severity,
        e.source || '',
        JSON.stringify(e.data),
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Events</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Real-time event stream from all plugins
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
            connected ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'
          }`}>
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm font-medium">{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <span className="font-medium text-gray-900 dark:text-white">Filters</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportEvents}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            <button
              onClick={clearEvents}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {['debug', 'info', 'warning', 'error', 'critical'].map(severity => (
            <button
              key={severity}
              onClick={() => toggleSeverity(severity)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedSeverity.includes(severity)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {severity}
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Event Stream ({events.length} events)
          </h2>
        </div>

        <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-start space-x-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className={`mt-1 ${getSeverityColor(event.severity)}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {event.type}
                  </p>
                  <span className={`badge ${getSeverityBadge(event.severity)}`}>
                    {event.severity}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {event.pluginId} • {event.source} • {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                </p>
                {Object.keys(event.data).length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline">
                      View data
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto">
                      {JSON.stringify(event.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No events yet. Waiting for activity...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    debug: 'text-gray-400',
    info: 'text-blue-500',
    warning: 'text-yellow-500',
    error: 'text-red-500',
    critical: 'text-red-600',
  };
  return colors[severity] || 'text-gray-400';
}

function getSeverityBadge(severity: string): string {
  const badges: Record<string, string> = {
    debug: 'badge-info',
    info: 'badge-info',
    warning: 'badge-warning',
    error: 'badge-error',
    critical: 'badge-error',
  };
  return badges[severity] || 'badge-info';
}
