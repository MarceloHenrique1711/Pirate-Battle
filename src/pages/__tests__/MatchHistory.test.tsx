import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { handlers } from '../../mocks/handlers';
import MatchHistory from '../MatchHistory';

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => { localStorage.clear(); localStorage.setItem('msw_latency', '0'); });
afterEach(() => { cleanup(); server.resetHandlers(); });
afterAll(() => server.close());

describe('Match history', () => {
  it('keeps the page usable after malformed JSON and allows retry', async () => {
    server.use(http.get('/api/history', () => HttpResponse.json({ items: [] })));
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
    render(<QueryClientProvider client={client}><MemoryRouter><MatchHistory /></MemoryRouter></QueryClientProvider>);

    expect(await screen.findByRole('alert', {}, { timeout: 6000 })).toHaveTextContent('Failed to load match history.');
    expect(screen.queryByText('No match history found. Play a game first!')).not.toBeInTheDocument();
    server.resetHandlers();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No match history found. Play a game first!')).toBeInTheDocument();
  }, 10000);
});
