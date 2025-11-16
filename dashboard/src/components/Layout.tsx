import { Outlet, NavLink } from 'react-router-dom';
import { Activity, Settings, List, Server } from 'lucide-react';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Activity className="w-8 h-8 text-blue-600" />
              <h1 className="ml-3 text-xl font-bold text-gray-900 dark:text-white">
                OPNsense MCP Dashboard
              </h1>
            </div>
            <div className="flex items-center space-x-1">
              <ConnectionStatus />
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`
              }
            >
              <Activity className="w-4 h-4 mr-2" />
              Dashboard
            </NavLink>
            <NavLink
              to="/plugins"
              className={({ isActive }) =>
                `flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`
              }
            >
              <Settings className="w-4 h-4 mr-2" />
              Plugins
            </NavLink>
            <NavLink
              to="/events"
              className={({ isActive }) =>
                `flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`
              }
            >
              <List className="w-4 h-4 mr-2" />
              Events
            </NavLink>
            <NavLink
              to="/system"
              className={({ isActive }) =>
                `flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`
              }
            >
              <Server className="w-4 h-4 mr-2" />
              System
            </NavLink>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function ConnectionStatus() {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  useEffect(() => {
    fetch('/api/system/status')
      .then(() => setStatus('connected'))
      .catch(() => setStatus('disconnected'));

    const interval = setInterval(() => {
      fetch('/api/system/status')
        .then(() => setStatus('connected'))
        .catch(() => setStatus('disconnected'));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center space-x-2">
      <div
        className={`w-2 h-2 rounded-full ${
          status === 'connected'
            ? 'bg-green-500'
            : status === 'connecting'
            ? 'bg-yellow-500'
            : 'bg-red-500'
        }`}
      />
      <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{status}</span>
    </div>
  );
}
