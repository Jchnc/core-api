import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor, ApiResponse } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should wrap standard payload in data object', (done) => {
    const mockExecutionContext = {} as ExecutionContext;
    const mockCallHandler = {
      handle: () => of({ id: 1, name: 'John Doe' }),
    } as CallHandler;

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
      expect(result).toEqual({ data: { id: 1, name: 'John Doe' } });
      done();
    });
  });

  it('should return the payload directly if it is already an ApiResponse', (done) => {
    const mockExecutionContext = {} as ExecutionContext;
    const existingResponse: ApiResponse<any> = { data: { id: 1 }, message: 'Success' };
    const mockCallHandler = {
      handle: () => of(existingResponse),
    } as CallHandler;

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
      expect(result).toEqual(existingResponse);
      done();
    });
  });
});
