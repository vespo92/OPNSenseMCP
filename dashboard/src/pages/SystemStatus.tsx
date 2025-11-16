import { useQuery } from '@tanstack/react-query';
import { Server, Activity, Cpu, HardDrive } from 'lucide-react';

export default function SystemStatus() {
  const { data: status } = useQuery({
    queryKey: ['system', 'status'],
    queryFn: async () => {
      const res = await fetch('/api/system/status');
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: stats } = useQuery({
    queryKey: ['system', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/system/stats');
      return res.json();
    },
    refetchInterval: 5000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">System Status</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Monitor system health and performance
        </p>
      </div>

      {/* Overall Health */}
      <div className="card">
        <div className="flex items-center space-x-4">
          <div className={`p-4 rounded-lg ${status?.healthy ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
            <Activity className={`w-8 h-8 ${status?.healthy ? 'text-green-600' : 'text-red-600'}`} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              System {status?.healthy ? 'Healthy' : 'Unhealthy'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Uptime: {formatUptime(status?.uptime || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Plugin Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Plugins</p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {status?.plugins?.total || 0}
              </p>
            </div>
            <Server className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Healthy</p>
              <p className="mt-2 text-3xl font-bold text-green-600">
                {status?.plugins?.healthy || 0}
              </p>
            </div>
            <Activity className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Unhealthy</p>
              <p className="mt-2 text-3xl font-bold text-red-600">
                {status?.plugins?.unhealthy || 0}
              </p>
            </div>
            <Activity className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* System Resources */}
      {stats?.memory && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">System Resources</h2>
          <div className="space-y-4">
            <ResourceBar
              label="Memory Usage"
              used={stats.memory.heapUsed}
              total={stats.memory.heapTotal}
              icon={<Cpu className="w-5 h-5" />}
            />
          </div>
        </div>
      )}

      {/* Events Summary */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Events Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(status?.events?.eventsBySeverity || {}).map(([severity, count]) => (
            <div key={severity} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{severity}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{count as number}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResourceBar({ label, used, total, icon }: any) {
  const percentage = (used / total) * 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {icon}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {formatBytes(used)} / {formatBytes(total)}
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {percentage.toFixed(1)}% used
      </p>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(' ') || '< 1m';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
