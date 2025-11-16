import { useQuery } from '@tanstack/react-query';
import { CheckCircle, AlertTriangle, Settings, Activity } from 'lucide-react';

export default function Plugins() {
  const { data: plugins, isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: async () => {
      const res = await fetch('/api/plugins');
      const data = await res.json();
      return data.plugins;
    },
    refetchInterval: 10000,
  });

  if (isLoading) {
    return <div className="text-center py-12">Loading plugins...</div>;
  }

  const groupedPlugins = plugins?.reduce((acc: any, plugin: any) => {
    if (!acc[plugin.category]) {
      acc[plugin.category] = [];
    }
    acc[plugin.category].push(plugin);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Plugins</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage and monitor OPNsense MCP plugins
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            {plugins?.length || 0} plugins loaded
          </span>
        </div>
      </div>

      {/* Plugin Groups */}
      <div className="space-y-6">
        {Object.entries(groupedPlugins || {}).map(([category, categoryPlugins]: [string, any]) => (
          <div key={category} className="card">
            <h2 className="text-xl font-semibold mb-4 capitalize text-gray-900 dark:text-white">
              {category} Plugins
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryPlugins.map((plugin: any) => (
                <PluginCard key={plugin.id} plugin={plugin} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PluginCard({ plugin }: { plugin: any }) {
  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <Settings className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">{plugin.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{plugin.version}</p>
          </div>
        </div>
        {plugin.health?.healthy ? (
          <CheckCircle className="w-5 h-5 text-green-500" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
        )}
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
        {plugin.description}
      </p>

      <div className="flex items-center justify-between">
        <span className={`badge ${plugin.state === 'running' ? 'badge-success' : 'badge-warning'}`}>
          {plugin.state}
        </span>
        <button className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium">
          View Details →
        </button>
      </div>
    </div>
  );
}
