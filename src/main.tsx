import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import { AuthProvider } from './providers/AuthProvider';
import { ConfirmProvider } from './providers/ConfirmProvider';
import { patchAntdForReact19 } from './lib/antdReact19Patch';
import { manabiTheme } from './theme';
import './styles/main.scss';

patchAntdForReact19();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={zhCN} theme={manabiTheme}>
      <ConfirmProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider><App /></AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ConfirmProvider>
    </ConfigProvider>
  </StrictMode>,
);
