import { AllExceptionsFilter } from './http-exception.filter';
import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  const createMockHost = (request: Partial<Request>, response: Partial<Response>): ArgumentsHost =>
    ({
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => response,
        getRequest: () => request,
      }),
    }) as unknown as ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should handle HttpException and include requestId in the response', () => {
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockResponse = { status: mockStatus } as unknown as Response;
    const mockRequest = {
      url: '/test',
      headers: { 'x-request-id': 'req-abc-123' },
    } as unknown as Request;

    const host = createMockHost(mockRequest, mockResponse);
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    filter.catch(exception, host);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Forbidden',
        error: 'Forbidden',
        path: '/test',
        requestId: 'req-abc-123',
      }),
    );
  });

  it('should handle HttpException with object response correctly', () => {
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockResponse = { status: mockStatus } as unknown as Response;
    const mockRequest = {
      url: '/test-validation',
      headers: { 'x-request-id': 'req-val-456' },
    } as unknown as Request;

    const host = createMockHost(mockRequest, mockResponse);
    const exception = new HttpException(
      { message: ['validation error'], error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: ['validation error'],
        error: 'Bad Request',
        path: '/test-validation',
        requestId: 'req-val-456',
      }),
    );
  });

  it('should handle standard Error and log with requestId', () => {
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockResponse = { status: mockStatus } as unknown as Response;
    const mockRequest = {
      url: '/internal',
      headers: { 'x-request-id': 'req-err-789' },
    } as unknown as Request;

    const host = createMockHost(mockRequest, mockResponse);
    const exception = new Error('Database down');

    filter.catch(exception, host);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        error: 'Internal Server Error',
        path: '/internal',
        requestId: 'req-err-789',
      }),
    );
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      '[req-err-789] Database down',
      expect.any(String),
    );
  });

  it('should fallback requestId to "-" when header is missing', () => {
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockResponse = { status: mockStatus } as unknown as Response;
    const mockRequest = {
      url: '/no-id',
      headers: {},
    } as unknown as Request;

    const host = createMockHost(mockRequest, mockResponse);
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, host);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: '-',
      }),
    );
  });
});
