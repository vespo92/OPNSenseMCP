import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useSSE } from '../hooks/useSSE';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const { events } = useSSE('/sse/events');

  const { data: systemStatus } = useQuery({
    queryKey: ['system', 'status'],
    queryFn: async () => {
      const res = await fetch('/api/system/status');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: pluginStats } = useQuery({
    queryKey: ['plugins', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/plugins');
      const data = await res.json();
      return data.plugins;
    },
    refetchInterval: 60000,
  });

  // Aggregate events for chart
  const eventData = events.slice(0, 50).reverse().map((e, i) => ({
    time: i,
    events: 1,
    severity: e.severity,
  }));

  const stats = {
    totalPlugins: pluginStats?.length || 0,
    runningPlugins: pluginStats?.filter((p: any) => p.state === 'running').length || 0,
    healthyPlugins: pluginStats?.filter((p: any) => p.health?.healthy).length || 0,
    totalEvents: events.length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Real-time overview of your OPNsense MCP server
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Plugins"
          value={stats.totalPlugins}
          icon={<Activity className="w-6 h-6" />}
          trend="+2"
          color="blue"
        />
        <StatCard
          title="Running Plugins"
          value={stats.runningPlugins}
          icon={<CheckCircle className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Healthy Plugins"
          value={stats.healthyPlugins}
          icon={<CheckCircle className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Recent Events"
          value={stats.totalEvents}
          icon={<Clock className="w-6 h-6" />}
          color="purple"
        />
      </div>

      {/* Event Timeline */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Event Timeline</h2>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={eventData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="events" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Events */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Recent Events</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {events.slice(0, 10).map((event) => (
              <div
                key={event.id}
                className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
              >
                <div className={`mt-0.5 ${getSeverityColor(event.severity)}`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {event.type}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {event.pluginId} • {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                  </p>
                </div>
                <span className={`badge ${getSeverityBadge(event.severity)}`}>
                  {event.severity}
                </span>
              </div>
            ))}
            {events.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                No events yet. Waiting for activity...
              </p>
            )}
          </div>
        </div>

        {/* Plugin Status */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Plugin Status</h2>
          <div className="space-y-2">
            {pluginStats?.slice(0, 10).map((plugin: any) => (
              <div
                key={plugin.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{plugin.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{plugin.category}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`badge ${plugin.state === 'running' ? 'badge-success' : 'badge-warning'}`}>
                    {plugin.state}
                  </span>
                  {plugin.health?.healthy ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend, color }: any) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20',
    green: 'text-green-600 bg-green-100 dark:bg-green-900/20',
    purple: 'text-purple-600 bg-purple-100 dark:bg-purple-900/20',
    red: 'text-red-600 bg-red-100 dark:bg-red-900/20',
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
          {trend && (
            <p className="mt-1 text-sm text-green-600 dark:text-green-400">+{trend} from last hour</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>{icon}</div>
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
