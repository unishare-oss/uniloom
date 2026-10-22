import { registerStream, signalUser } from './notification.listener.js';

describe('notification stream registry', () => {
  it('signals only the streams of that user', () => {
    const first = vi.fn();
    const second = vi.fn();
    const other = vi.fn();
    registerStream('a', first);
    registerStream('a', second);
    registerStream('b', other);
    signalUser('a');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });

  it('stops signalling a stream once it is unregistered', () => {
    const send = vi.fn();
    const unregister = registerStream('c', send);
    unregister();
    signalUser('c');
    expect(send).not.toHaveBeenCalled();
  });
});
