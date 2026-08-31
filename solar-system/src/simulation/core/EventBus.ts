export type EventHandler<Payload> = (payload: Payload) => void;
export type Unsubscribe = () => void;

export class EventBus<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<EventHandler<never>>>();

  public on<Key extends keyof Events>(key: Key, handler: EventHandler<Events[Key]>): Unsubscribe {
    let handlers = this.listeners.get(key);
    if (handlers === undefined) {
      handlers = new Set<EventHandler<never>>();
      this.listeners.set(key, handlers);
    }
    handlers.add(handler as EventHandler<never>);
    return () => this.off(key, handler);
  }

  public once<Key extends keyof Events>(key: Key, handler: EventHandler<Events[Key]>): Unsubscribe {
    let unsubscribe: Unsubscribe = () => undefined;
    unsubscribe = this.on(key, (payload) => {
      unsubscribe();
      handler(payload);
    });
    return unsubscribe;
  }

  public off<Key extends keyof Events>(key: Key, handler: EventHandler<Events[Key]>): void {
    const handlers = this.listeners.get(key);
    handlers?.delete(handler as EventHandler<never>);
    if (handlers?.size === 0) {
      this.listeners.delete(key);
    }
  }

  public emit<Key extends keyof Events>(key: Key, payload: Events[Key]): void {
    const handlers = this.listeners.get(key);
    if (handlers === undefined) {
      return;
    }
    for (const handler of [...handlers]) {
      (handler as EventHandler<Events[Key]>)(payload);
    }
  }

  public listenerCount<Key extends keyof Events>(key: Key): number {
    return this.listeners.get(key)?.size ?? 0;
  }

  public clear(key?: keyof Events): void {
    if (key === undefined) {
      this.listeners.clear();
      return;
    }
    this.listeners.delete(key);
  }
}
