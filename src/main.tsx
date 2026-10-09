import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { worker } from './mocks/browser';
import './index.css';
const queryClient = new QueryClient();
async function start() {
  try {

    await worker.start({ onUnhandledFrame: 'bypass' });
  } catch (error) {
    console.error('Mock API unavailable; local gameplay is still available.', error);
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode><QueryClientProvider client={queryClient}><App /></QueryClientProvider></React.StrictMode>,
  );
}
void start();
