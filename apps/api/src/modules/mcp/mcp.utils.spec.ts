import { apiError } from '@/http.js';
import { toToolError } from './mcp.utils.js';

describe('toToolError', () => {
  it('shows an apiError as `code: message`', async () => {
    expect(
      await toToolError(apiError(404, 'not_found', 'Item not found')),
    ).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'not_found: Item not found' }],
    });
  });

  it('logs any other error and never shows its message to the agent', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Invalid prisma.item.findFirst() invocation');
    expect(await toToolError(error)).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'internal_error: Something went wrong' }],
    });
    expect(log).toHaveBeenCalledWith(error);
    log.mockRestore();
  });
});
