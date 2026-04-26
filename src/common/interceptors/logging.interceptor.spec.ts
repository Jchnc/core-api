import { ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should log the request with request ID, method, url, status code, and execution time', (done) => {
    const loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/api/v1/users',
          headers: { 'x-request-id': 'test-uuid-1234' },
        }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;

    const mockCallHandler = {
      handle: () => of(null),
    } as CallHandler;

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe(() => {
      expect(loggerSpy).toHaveBeenCalled();
      const logMessage = loggerSpy.mock.calls[0][0];
      expect(logMessage).toMatch(/\[test-uuid-1234\] GET \/api\/v1\/users 200/);
      done();
    });
  });

  it('should fallback to "-" when no request ID header is present', (done) => {
    const loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => ({
          method: 'POST',
          originalUrl: '/api/v1/auth/login',
          headers: {},
        }),
        getResponse: () => ({ statusCode: 201 }),
      }),
    } as unknown as ExecutionContext;

    const mockCallHandler = {
      handle: () => of(null),
    } as CallHandler;

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe(() => {
      expect(loggerSpy).toHaveBeenCalled();
      const logMessage = loggerSpy.mock.calls[0][0];
      expect(logMessage).toMatch(/\[-\] POST \/api\/v1\/auth\/login 201/);
      done();
    });
  });
});
