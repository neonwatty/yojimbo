import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { InstancesPage } from './pages/InstancesPage';
import { HistoryPage } from './pages/HistoryPage';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import { useStatusUpdates } from './hooks/use-status-updates';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

function AppRoutes() {
  // Set up global keyboard shortcuts
  useKeyboardShortcuts();

  // Set up WebSocket status updates listener
  useStatusUpdates();

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/instances" element={<InstancesPage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </Layout>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
