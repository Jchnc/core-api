import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Assigns a unique request ID to every incoming request.
 *
 * - If the client sends an `X-Request-Id` header, that value is reused
 *   (useful for distributed tracing across services).
 * - Otherwise a new UUIDv4 is generated.
 * - The ID is echoed back in the response headers so clients can
 *   correlate their request with server-side logs.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const id = (req.headers[REQUEST_ID_HEADER] as string | undefined) ?? randomUUID();

    req.headers[REQUEST_ID_HEADER] = id;
    res.setHeader(REQUEST_ID_HEADER, id);

    next();
  }
}
