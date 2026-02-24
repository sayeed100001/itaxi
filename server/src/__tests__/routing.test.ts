import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as routingService from '../services/routing.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Routing Service - Circuit Breaker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return cached result on second call', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        routes: [{
          geometry: 'test',
          summary: { distance: 1000, duration: 60 }
        }]
      }
    });

    const start = { lat: 34.5, lng: 69.1 };
    const end = { lat: 34.6, lng: 69.2 };

    const result1 = await routingService.getDirections(start, end);
    const result2 = await routingService.getDirections(start, end);

    expect(result1).toEqual(result2);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('should open circuit after 5 failures', async () => {
    mockedAxios.post.mockRejectedValue(new Error('Network error'));

    const start = { lat: 34.5, lng: 69.1 };
    const end = { lat: 34.6, lng: 69.2 };

    for (let i = 0; i < 5; i++) {
      try {
        await routingService.getDirections(start, end);
      } catch (error) {
        // Expected
      }
    }

    // 6th call should fail with circuit breaker open
    await expect(routingService.getDirections(start, end))
      .rejects.toThrow('Routing service unavailable');

    const state = routingService.getCircuitState();
    expect(state.state).toBe('OPEN');
  });

  it('should respect timeout', async () => {
    mockedAxios.post.mockImplementation(() => 
      new Promise((resolve) => setTimeout(resolve, 10000))
    );

    const start = { lat: 34.5, lng: 69.1 };
    const end = { lat: 34.6, lng: 69.2 };

    await expect(routingService.getDirections(start, end))
      .rejects.toThrow();
  });

  it('should track metrics', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        routes: [{
          geometry: 'test',
          summary: { distance: 1000, duration: 60 }
        }]
      }
    });

    const start = { lat: 34.5, lng: 69.1 };
    const end = { lat: 34.6, lng: 69.2 };

    await routingService.getDirections(start, end);

    const metrics = routingService.getMetrics();
    expect(metrics.success).toBeGreaterThan(0);
  });
});

describe('Routing Service - Cache', () => {
  it('should increment cache hits on repeated calls', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        routes: [{
          geometry: 'test',
          summary: { distance: 1000, duration: 60 }
        }]
      }
    });

    const start = { lat: 34.5, lng: 69.1 };
    const end = { lat: 34.6, lng: 69.2 };

    await routingService.getDirections(start, end);
    await routingService.getDirections(start, end);

    const metrics = routingService.getMetrics();
    expect(metrics.cacheHits).toBeGreaterThan(0);
  });
});
