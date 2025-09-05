export type WinsMap = Record<string, number>;

export type FetchOpts = {
  season?: number;
  week?: number;
};

export interface WinsProvider {
  name: string;
  fetchWins(opts: FetchOpts): Promise<WinsMap>;
}
