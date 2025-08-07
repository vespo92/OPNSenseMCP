# Error Handling Strategy - OPNSense MCP Server

## 🎯 Design Principles

### 1. Error Hierarchy
All errors should extend from base classes that provide consistent structure:
- **Structured errors** with codes, context, and recovery hints
- **Preserving stack traces** for debugging
- **Serializable** for API responses and logging
- **Actionable** with clear remediation steps

### 2. Error Categories
- **Operational Errors**: Expected failures (network, validation, auth)
- **Programming Errors**: Bugs that should never happen
- **External Errors**: Third-party service failures

## 🏗️ Error Class Hierarchy

```typescript
// src/errors/base.ts
export abstract class BaseError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  abstract readonly isOperational: boolean;
  
  constructor(
    message: string,
    public readonly context?: Record<string, any>,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack
    };
  }
}
```

## 📦 Error Types Implementation

### 1. API Errors
```typescript
// src/errors/api-errors.ts
export class APIError extends BaseError {
  readonly isOperational = true;
  
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, context, cause);
  }
}

export class AuthenticationError extends APIError {
  readonly code = 'AUTH_FAILED';
  readonly statusCode = 401;
  
  constructor(message = 'Authentication failed', context?: Record<string, any>) {
    super(message, 'AUTH_FAILED', 401, context);
  }
}

export class NotFoundError extends APIError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;
  
  constructor(resource: string, id: string) {
    super(
      `${resource} with id ${id} not found`,
      'NOT_FOUND',
      404,
      { resource, id }
    );
  }
}

export class RateLimitError extends APIError {
  readonly code = 'RATE_LIMIT';
  readonly statusCode = 429;
  
  constructor(
    public readonly retryAfter: number,
    public readonly limit: number
  ) {
    super(
      'Rate limit exceeded',
      'RATE_LIMIT',
      429,
      { retryAfter, limit }
    );
  }
}
```

### 2. Validation Errors
```typescript
// src/errors/validation-errors.ts
export interface ValidationIssue {
  path: string;
  message: string;
  value?: any;
}

export class ValidationError extends BaseError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
  readonly isOperational = true;
  
  constructor(
    public readonly issues: ValidationIssue[],
    message = 'Validation failed'
  ) {
    super(message, { issues });
  }
  
  static fromZodError(error: ZodError): ValidationError {
    const issues = error.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
      value: e.received
    }));
    return new ValidationError(issues);
  }
}
```

### 3. Resource Errors
```typescript
// src/errors/resource-errors.ts
export class ResourceError extends BaseError {
  readonly isOperational = true;
  readonly statusCode = 409;
  
  constructor(
    message: string,
    public readonly code: string,
    context?: Record<string, any>
  ) {
    super(message, context);
  }
}

export class ResourceConflictError extends ResourceError {
  readonly code = 'RESOURCE_CONFLICT';
  
  constructor(
    resource: string,
    conflictField: string,
    conflictValue: any
  ) {
    super(
      `${resource} already exists with ${conflictField}=${conflictValue}`,
      'RESOURCE_CONFLICT',
      { resource, conflictField, conflictValue }
    );
  }
}

export class ResourceStateError extends ResourceError {
  readonly code = 'INVALID_STATE';
  
  constructor(
    resource: string,
    currentState: string,
    requiredState: string
  ) {
    super(
      `${resource} is in ${currentState} state, requires ${requiredState}`,
      'INVALID_STATE',
      { resource, currentState, requiredState }
    );
  }
}
```

### 4. Network Errors
```typescript
// src/errors/network-errors.ts
export class NetworkError extends BaseError {
  readonly isOperational = true;
  readonly statusCode = 503;
  
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, context, cause);
  }
}

export class ConnectionError extends NetworkError {
  readonly code = 'CONNECTION_FAILED';
  
  constructor(
    host: string,
    port: number,
    cause?: Error
  ) {
    super(
      `Failed to connect to ${host}:${port}`,
      'CONNECTION_FAILED',
      true,
      { host, port },
      cause
    );
  }
}

export class TimeoutError extends NetworkError {
  readonly code = 'TIMEOUT';
  
  constructor(
    operation: string,
    timeout: number
  ) {
    super(
      `${operation} timed out after ${timeout}ms`,
      'TIMEOUT',
      true,
      { operation, timeout }
    );
  }
}
```

## 🔄 Error Handling Patterns

### 1. Retry Logic with Exponential Backoff
```typescript
// src/utils/retry.ts
export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  factor: number;
  retryableErrors?: string[];
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error;
  let delay = options.initialDelay;
  
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      if (!isRetryable(error, options.retryableErrors)) {
        throw error;
      }
      
      if (attempt === options.maxAttempts) {
        throw new MaxRetriesError(lastError, attempt);
      }
      
      // Wait with exponential backoff
      await sleep(delay);
      delay = Math.min(delay * options.factor, options.maxDelay);
    }
  }
  
  throw lastError!;
}
```

### 2. Circuit Breaker Pattern
```typescript
// src/utils/circuit-breaker.ts
export class CircuitBreaker {
  private failures = 0;
  private lastFailTime?: Date;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private readonly threshold: number,
    private readonly timeout: number
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new CircuitOpenError();
      }
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
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailTime = new Date();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }
  
  private shouldAttemptReset(): boolean {
    return this.lastFailTime 
      ? Date.now() - this.lastFailTime.getTime() > this.timeout
      : false;
  }
}
```

### 3. Global Error Handler
```typescript
// src/utils/error-handler.ts
export class ErrorHandler {
  private static handlers = new Map<string, ErrorHandlerFn>();
  
  static register(code: string, handler: ErrorHandlerFn) {
    this.handlers.set(code, handler);
  }
  
  static async handle(error: Error): Promise<void> {
    // Log error
    logger.error(error);
    
    // Check if operational
    if (error instanceof BaseError && !error.isOperational) {
      // Programming error - should alert/crash
      await this.alertProgrammingError(error);
      process.exit(1);
    }
    
    // Find specific handler
    if (error instanceof BaseError) {
      const handler = this.handlers.get(error.code);
      if (handler) {
        await handler(error);
      }
    }
    
    // Default handling
    await this.defaultHandler(error);
  }
  
  private static async defaultHandler(error: Error) {
    // Send to monitoring
    await monitoring.recordError(error);
    
    // Check for recovery
    if (error instanceof NetworkError && error.retryable) {
      // Schedule retry
      await scheduler.scheduleRetry(error.context);
    }
  }
}
```

## 🛡️ Error Boundaries

### MCP Tool Error Boundary
```typescript
// src/tools/error-boundary.ts
export function withErrorBoundary(
  handler: ToolHandler
): ToolHandler {
  return async (args: any) => {
    try {
      return await handler(args);
    } catch (error) {
      // Convert to user-friendly error
      if (error instanceof ValidationError) {
        return {
          error: 'Invalid input',
          details: error.issues,
          code: error.code
        };
      }
      
      if (error instanceof NotFoundError) {
        return {
          error: error.message,
          code: error.code
        };
      }
      
      // Log unexpected errors
      if (!(error instanceof BaseError)) {
        logger.error('Unexpected error in tool', { error, args });
      }
      
      // Generic error response
      return {
        error: 'Operation failed',
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR'
      };
    }
  };
}
```

## 📝 Error Codes Reference

### Standard Error Codes
| Code | Description | HTTP Status | Retryable |
|------|-------------|-------------|-----------|
| `AUTH_FAILED` | Authentication failure | 401 | No |
| `FORBIDDEN` | Authorization failure | 403 | No |
| `NOT_FOUND` | Resource not found | 404 | No |
| `VALIDATION_ERROR` | Input validation failed | 400 | No |
| `RESOURCE_CONFLICT` | Resource already exists | 409 | No |
| `INVALID_STATE` | Invalid resource state | 409 | No |
| `RATE_LIMIT` | Rate limit exceeded | 429 | Yes |
| `CONNECTION_FAILED` | Network connection failed | 503 | Yes |
| `TIMEOUT` | Operation timeout | 504 | Yes |
| `CIRCUIT_OPEN` | Circuit breaker open | 503 | Yes |
| `INTERNAL_ERROR` | Internal server error | 500 | Maybe |

## 🔧 Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create `src/errors/` directory
- [ ] Implement base error classes
- [ ] Create error type definitions
- [ ] Add error serialization

### Phase 2: Specific Error Types
- [ ] Implement API error classes
- [ ] Implement validation error classes
- [ ] Implement resource error classes
- [ ] Implement network error classes

### Phase 3: Error Handling Utilities
- [ ] Implement retry logic
- [ ] Implement circuit breaker
- [ ] Create global error handler
- [ ] Add error boundaries

### Phase 4: Integration
- [ ] Update API client to use new errors
- [ ] Update tools to use error boundaries
- [ ] Update resources to throw typed errors
- [ ] Add error recovery mechanisms

### Phase 5: Monitoring & Logging
- [ ] Integrate with logging system
- [ ] Add error metrics
- [ ] Create error dashboards
- [ ] Set up alerts for critical errors

## 📊 Success Metrics

1. **Error Clarity**: All errors have clear messages and remediation steps
2. **Error Recovery**: 80% of network errors successfully retry
3. **Error Tracking**: 100% of errors logged with context
4. **User Experience**: No raw stack traces exposed to users
5. **Developer Experience**: Easy to throw and catch specific error types

## 🚨 Migration Guide

### Before (Current Code):
```typescript
throw new Error('VLAN not found');
```

### After (With Strategy):
```typescript
throw new NotFoundError('VLAN', vlanId);
```

### Catching Errors:
```typescript
try {
  await vlanResource.create(config);
} catch (error) {
  if (error instanceof ResourceConflictError) {
    // Handle duplicate VLAN
  } else if (error instanceof ValidationError) {
    // Handle validation issues
  } else {
    // Unexpected error
    throw error;
  }
}
```

---

*This strategy provides a comprehensive approach to error handling that improves reliability, debuggability, and user experience.*