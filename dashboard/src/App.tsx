import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import Plugins from './pages/Plugins';
import SystemStatus from './pages/SystemStatus';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="plugins" element={<Plugins />} />
          <Route path="events" element={<Events />} />
          <Route path="system" element={<SystemStatus />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
