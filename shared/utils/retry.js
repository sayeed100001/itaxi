// Retry mechanism for external API calls
class RetryHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 30000; // 30 seconds
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.retryableErrors = options.retryableErrors || [
      'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 
      'ENOTFOUND', 'EAI_AGAIN', '5xx', '429'
    ];
  }

  // Exponential backoff calculation
  calculateDelay(attempt) {
    const delay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt);
    return Math.min(delay, this.maxDelay);
  }

  // Check if error is retryable
  isRetryableError(error) {
    const errorStr = error.code || error.message || String(error);
    return this.retryableErrors.some(retryable =>
      errorStr.includes(retryable) || 
      (retryable === '5xx' && errorStr.includes('5')) ||
      (retryable === '429' && errorStr.includes('429'))
    );
  }

  // Execute function with retry logic
  async execute(fn, context = null) {
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn.call(context);
      } catch (error) {
        lastError = error;
        
        // Don't retry on non-retryable errors
        if (!this.isRetryableError(error)) {
          throw error;
        }
        
        // If max retries reached, throw the last error
        if (attempt === this.maxRetries) {
          break;
        }

        const delay = this.calculateDelay(attempt);
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        console.log('Error:', error.message || error);

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

// Idempotency key generator
const generateIdempotencyKey = () => {
  return `idemp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Idempotency key storage (in production, use Redis or database)
const idempotencyStore = new Map();

// Process with idempotency check
const processWithIdempotency = async (key, processFn) => {
  // Check if request with this idempotency key was already processed
  if (idempotencyStore.has(key)) {
    const storedResult = idempotencyStore.get(key);
    
    // Check if result is still valid (not expired)
    if (storedResult.expiry > Date.now()) {
      console.log(`Idempotency key ${key} already processed, returning cached result`);
      return storedResult.result;
    } else {
      // Expired, remove from store
      idempotencyStore.delete(key);
    }
  }

  // Process the function
  const result = await processFn();

  // Store result with expiry (1 hour)
  idempotencyStore.set(key, {
    result,
    expiry: Date.now() + 60 * 60 * 1000 // 1 hour
  });

  return result;
};

// Dead letter queue simulation using database
class DeadLetterQueue {
  constructor(db) {
    this.db = db; // Prisma client instance
    this.processingInterval = null;
  }

  // Add failed job to dead letter queue
  async addToDLQ(jobData, error, serviceName, maxRetries = 3) {
    try {
      await this.db.deadLetterQueue.create({
        data: {
          serviceName,
          payload: JSON.stringify(jobData),
          error: error.message || String(error),
          attempts: 1,
          maxRetries,
          status: 'failed',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      console.log(`Added job to DLQ for service ${serviceName}`);
    } catch (dbError) {
      console.error('Failed to add job to DLQ:', dbError);
    }
  }

  // Process dead letter queue items
  async processDLQ() {
    try {
      // Get failed jobs that haven't exceeded max retries
      const failedJobs = await this.db.deadLetterQueue.findMany({
        where: {
          status: 'failed',
          attempts: { lt: this.maxRetries },
          retryAfter: { lte: new Date() }
        },
        orderBy: { createdAt: 'asc' },
        take: 10 // Process up to 10 jobs at a time
      });

      for (const job of failedJobs) {
        try {
          // Attempt to reprocess the job
          const payload = JSON.parse(job.payload);
          
          // Here you would call the appropriate service function based on service name
          // This is a simplified version - in practice you'd have specific handlers
          await this.reprocessJob(job.serviceName, payload);
          
          // Mark job as successful
          await this.db.deadLetterQueue.update({
            where: { id: job.id },
            data: { 
              status: 'completed',
              updatedAt: new Date()
            }
          });
          
          console.log(`Successfully reprocessed job ${job.id}`);
        } catch (error) {
          // Increment attempts and schedule retry
          const newAttempts = job.attempts + 1;
          const retryAfter = new Date(Date.now() + Math.pow(2, newAttempts) * 60 * 1000); // Exponential backoff in minutes
          
          await this.db.deadLetterQueue.update({
            where: { id: job.id },
            data: { 
              attempts: newAttempts,
              error: error.message || String(error),
              retryAfter,
              updatedAt: new Date()
            }
          });
          
          console.log(`Failed to reprocess job ${job.id}, scheduled retry for ${retryAfter}`);
        }
      }
    } catch (error) {
      console.error('Error processing DLQ:', error);
    }
  }

  // Reprocess a specific job (stub implementation)
  async reprocessJob(serviceName, payload) {
    // In a real implementation, you would route to the appropriate service
    // based on the serviceName and re-execute the operation
    console.log(`Reprocessing job for service: ${serviceName}`, payload);
    // Simulate processing - in reality, you'd call the appropriate service function
    return Promise.resolve();
  }

  // Start periodic DLQ processing
  startProcessing(interval = 5 * 60 * 1000) { // Every 5 minutes
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    this.processingInterval = setInterval(() => {
      this.processDLQ();
    }, interval);
    
    console.log('Started DLQ processing with interval:', interval);
  }

  // Stop DLQ processing
  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('Stopped DLQ processing');
    }
  }
}

// Stripe payment retry wrapper
const createStripePaymentWithRetry = async (stripe, paymentData) => {
  const retryHandler = new RetryHandler({
    maxRetries: 3,
    baseDelay: 1000,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', '5xx', '429']
  });

  return retryHandler.execute(async () => {
    return await stripe.paymentIntents.create(paymentData);
  });
};

// WhatsApp API retry wrapper
const sendWhatsAppMessageWithRetry = async (axios, messageData) => {
  const retryHandler = new RetryHandler({
    maxRetries: 3,
    baseDelay: 1000,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', '5xx', '429']
  });

  return retryHandler.execute(async () => {
    return await axios.post('/messages', messageData);
  });
};

module.exports = {
  RetryHandler,
  generateIdempotencyKey,
  processWithIdempotency,
  DeadLetterQueue,
  createStripePaymentWithRetry,
  sendWhatsAppMessageWithRetry
};