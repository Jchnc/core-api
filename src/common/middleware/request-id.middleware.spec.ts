import { Request, Response, NextFunction } from 'express';
import { RequestIdMiddleware, REQUEST_ID_HEADER } from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
    mockReq = { headers: {} };
    mockRes = { setHeader: jest.fn() };
    next = jest.fn();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should generate a UUID when no X-Request-Id header is present', () => {
    middleware.use(mockReq as Request, mockRes as Response, next);

    const id = mockReq.headers![REQUEST_ID_HEADER] as string;

    expect(id).toBeDefined();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(mockRes.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, id);
    expect(next).toHaveBeenCalled();
  });

  it('should reuse the client-provided X-Request-Id header', () => {
    const clientId = 'client-trace-abc-123';
    mockReq.headers = { [REQUEST_ID_HEADER]: clientId };

    middleware.use(mockReq as Request, mockRes as Response, next);

    expect(mockReq.headers[REQUEST_ID_HEADER]).toBe(clientId);
    expect(mockRes.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, clientId);
    expect(next).toHaveBeenCalled();
  });
});
