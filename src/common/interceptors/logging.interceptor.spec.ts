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

  it('should log the request method, url, status code, and execution time', (done) => {
    const loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => ({ method: 'GET', originalUrl: '/api/v1/users' }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;

    const mockCallHandler = {
      handle: () => of(null),
    } as CallHandler;

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe(() => {
      expect(loggerSpy).toHaveBeenCalled();
      const logMessage = loggerSpy.mock.calls[0][0];
      expect(logMessage).toMatch(/\[HTTP\] GET \/api\/v1\/users 200 - \d+ms/);
      done();
    });
  });
});
