import logger from '../config/logger';

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = Date.now();
  private options: CircuitBreakerOptions;
  private name: string;

  constructor(name: string, options?: Partial<CircuitBreakerOptions>) {
    this.name = name;
    this.options = {
      failureThreshold: options?.failureThreshold || 5,
      resetTimeout: options?.resetTimeout || 60000,
      monitoringPeriod: options?.monitoringPeriod || 10000,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        logger.error(`Circuit breaker OPEN for ${this.name}`, {
          failureCount: this.failureCount,
          nextAttempt: new Date(this.nextAttempt).toISOString(),
        });
        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      }
      this.state = CircuitState.HALF_OPEN;
      logger.info(`Circuit breaker HALF_OPEN for ${this.name}`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      logger.info(`Circuit breaker CLOSED for ${this.name}`);
    }
    this.successCount++;
  }

  private onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.options.resetTimeout;
      logger.error(`Circuit breaker OPEN for ${this.name}`, {
        failureCount: this.failureCount,
        threshold: this.options.failureThreshold,
      });
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
    };
  }
}
