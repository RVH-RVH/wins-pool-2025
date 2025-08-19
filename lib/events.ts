import { EventEmitter } from "events";

const globalForBus = global as unknown as { __winsPoolBus?: EventEmitter };

export const bus =
  globalForBus.__winsPoolBus ??
  new EventEmitter();

if (!globalForBus.__winsPoolBus) {
  globalForBus.__winsPoolBus = bus;
}

// Helper to scope by league
export function emitLeagueUpdate(leagueId: string, payload: any) {
  bus.emit(`league:${leagueId}`, payload);
}

export function onLeagueUpdate(leagueId: string, listener: (payload: any) => void) {
  const ev = `league:${leagueId}`;
  bus.on(ev, listener);
  return () => bus.off(ev, listener);
}
