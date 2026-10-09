import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../../mocks/handlers';
import Ranking from '../Ranking';
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => { localStorage.clear(); localStorage.setItem('msw_latency', '0'); });
afterEach(() => { cleanup(); server.resetHandlers(); });
afterAll(() => server.close());
function renderRanking() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><Ranking /></MemoryRouter></QueryClientProvider>);
}
describe('Ranking', () => {
  it('shows loading while the request is pending', () => {
    renderRanking();
    expect(screen.getByText('Loading rankings...')).toBeInTheDocument();
  });
  it('shows fixture data from the real Axios/MSW path', async () => {
    renderRanking();
    expect(await screen.findByText('Blackbeard')).toBeInTheDocument();
    expect(screen.getByText('Captain Hook')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('PAGE 1 OF 3')).toBeInTheDocument();
  });
});
