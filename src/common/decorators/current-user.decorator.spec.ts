import { ExecutionContext } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';

describe('@CurrentUser Decorator', () => {
  it('should extract the user object from the request', () => {
    // Create a dummy class to apply the decorator
    class TestClass {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      public testMethod(@CurrentUser() _user: unknown) {
        // dummy method
      }
    }

    // Extract the factory from the metadata
    const metadata = Reflect.getMetadata('__routeArguments__', TestClass, 'testMethod');
    const key = Object.keys(metadata)[0];
    const factory = metadata[key].factory as (data: unknown, ctx: ExecutionContext) => unknown;

    const mockUser = { id: 1, email: 'test@example.com' };
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: mockUser,
        }),
      }),
    } as unknown as ExecutionContext;

    const result = factory(null, mockExecutionContext);
    expect(result).toEqual(mockUser);
  });
});
