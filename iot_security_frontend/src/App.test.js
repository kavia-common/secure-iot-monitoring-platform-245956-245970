import { render, screen } from '@testing-library/react';
import App from './App';

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      status: 'ok',
      message: 'healthy',
      services: {
        database: 'connected:myapp',
        realtime: 'ready',
        mockGenerator: 'running'
      }
    })
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  window.localStorage.clear();
});

test('renders the IoT integration dashboard heading', async () => {
  render(<App />);

  expect(
    await screen.findByText(/IoT Security Monitoring Platform/i)
  ).toBeInTheDocument();
});
