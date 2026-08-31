import { DeterministicRandom } from '../../simulation/core/DeterministicRandom';
import { EventBus } from '../../simulation/core/EventBus';

describe('DeterministicRandom', () => {
  it('matches the Mulberry32 golden sequence and state transitions', () => {
    const random = new DeterministicRandom(0x1234_5678);
    const outputs = Array.from({ length: 6 }, () => random.nextUint32());

    expect(outputs).toEqual([
      455_919_406,
      4_042_750_857,
      4_036_713_555,
      1_004_527_575,
      3_885_174_651,
      3_342_903_291,
    ]);
    expect(random.getState()).toBe(2_704_880_182);
  });

  it('restores a serialized state exactly', () => {
    const random = new DeterministicRandom(42);
    random.nextUint32();
    random.nextUint32();
    const savedState = random.getState();
    const expectedNext = random.nextUint32();

    random.setState(savedState);
    expect(random.nextUint32()).toBe(expectedNext);
  });

  it('produces half-open unit floats and deterministic ranges', () => {
    const floatRandom = new DeterministicRandom(0x1234_5678);
    expect(floatRandom.nextFloat()).toBe(455_919_406 / 0x1_0000_0000);

    const first = new DeterministicRandom(9);
    const second = new DeterministicRandom(9);
    const firstValues = Array.from({ length: 50 }, () => first.range(-5, 12));
    const secondValues = Array.from({ length: 50 }, () => second.range(-5, 12));

    expect(firstValues).toEqual(secondValues);
    for (const value of firstValues) {
      expect(value).toBeGreaterThanOrEqual(-5);
      expect(value).toBeLessThan(12);
    }
  });

  it('normalizes signed integer seeds to uint32', () => {
    const signed = new DeterministicRandom(-1);
    const unsigned = new DeterministicRandom(0xffff_ffff);

    expect(signed.getState()).toBe(0xffff_ffff);
    expect(signed.nextUint32()).toBe(unsigned.nextUint32());
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects invalid seed/state %s',
    (value) => {
      expect(() => new DeterministicRandom(value)).toThrow(RangeError);
      const random = new DeterministicRandom(1);
      expect(() => random.setState(value)).toThrow(RangeError);
    },
  );

  it('validates random range bounds', () => {
    const random = new DeterministicRandom(1);
    expect(random.range(5, 5)).toBe(5);
    expect(() => random.range(2, 1)).toThrow(RangeError);
    expect(() => random.range(Number.NaN, 1)).toThrow(RangeError);
    expect(() => random.range(0, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

interface TestEvents {
  readonly value: number;
  readonly message: string;
}

describe('EventBus', () => {
  it('subscribes, emits typed payloads, and unsubscribes idempotently', () => {
    const bus = new EventBus<TestEvents>();
    const values: number[] = [];
    const unsubscribe = bus.on('value', (value) => values.push(value));

    expect(bus.listenerCount('value')).toBe(1);
    bus.emit('value', 3);
    unsubscribe();
    unsubscribe();
    bus.emit('value', 4);

    expect(values).toEqual([3]);
    expect(bus.listenerCount('value')).toBe(0);
  });

  it('removes a once-listener before invoking it, including recursive emits', () => {
    const bus = new EventBus<TestEvents>();
    const values: number[] = [];
    bus.once('value', (value) => {
      values.push(value);
      bus.emit('value', value + 1);
    });

    bus.emit('value', 10);
    bus.emit('value', 20);

    expect(values).toEqual([10]);
    expect(bus.listenerCount('value')).toBe(0);
  });

  it('allows a once-listener to be cancelled before its first event', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    const unsubscribe = bus.once('message', handler);

    unsubscribe();
    bus.emit('message', 'ignored');

    expect(handler).not.toHaveBeenCalled();
  });

  it('uses a listener snapshot when subscriptions mutate during emit', () => {
    const bus = new EventBus<TestEvents>();
    const calls: string[] = [];
    const late = (value: number) => calls.push(`late:${value}`);
    let removeSecond: () => void = () => undefined;

    bus.on('value', (value) => {
      calls.push(`first:${value}`);
      removeSecond();
      bus.on('value', late);
    });
    removeSecond = bus.on('value', (value) => calls.push(`second:${value}`));

    bus.emit('value', 1);
    bus.emit('value', 2);

    expect(calls).toEqual(['first:1', 'second:1', 'first:2', 'late:2']);
  });

  it('supports explicit off, per-key clear, and complete clear', () => {
    const bus = new EventBus<TestEvents>();
    const valueHandler = vi.fn();
    const messageHandler = vi.fn();
    bus.on('value', valueHandler);
    bus.on('message', messageHandler);

    bus.off('value', valueHandler);
    bus.emit('value', 1);
    expect(valueHandler).not.toHaveBeenCalled();

    bus.clear('message');
    expect(bus.listenerCount('message')).toBe(0);
    bus.on('value', valueHandler);
    bus.on('message', messageHandler);
    bus.clear();
    expect(bus.listenerCount('value')).toBe(0);
    expect(bus.listenerCount('message')).toBe(0);
  });
});
