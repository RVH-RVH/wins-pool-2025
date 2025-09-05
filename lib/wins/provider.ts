export type WinsMap = Record<string, number>;
export type FetchOpts = { season?: number; week?: number };
export interface WinsProvider { name: string; fetchWins(opts: FetchOpts): Promise<WinsMap>; }

// ---- known teams + normalizer (same IDs your app uses) ----
const KNOWN_TEAMS = new Set([
  "BUF","MIA","NE","NYJ","BAL","CIN","CLE","PIT","HOU","IND","JAX","TEN",
  "DEN","KC","LV","LAC","DAL","NYG","PHI","WAS","CHI","DET","GB","MIN",
  "ATL","CAR","NO","TB","ARI","LA","SF","SEA",
]);

export function normalizeTeamKey(abbr: string): string | undefined {
  const ESPN_TEAM_MAP: Record<string, string> = {
    ARI: "ari", ATL: "atl", BAL: "bal", BUF: "buf", CAR: "car",
    CHI: "chi", CIN: "cin", CLE: "cle", DAL: "dal", DEN: "den",
    DET: "det", GB: "gb", HOU: "hou", IND: "ind", JAX: "jax",
    KC: "kc", LV: "lv", LAC: "lac", LAR: "lar", MIA: "mia",
    MIN: "min", NE: "ne", NO: "no", NYG: "nyg", NYJ: "nyj",
    PHI: "phi", PIT: "pit", SF: "sf", SEA: "sea", TB: "tb",
    TEN: "ten", WSH: "wsh",
  };
  return ESPN_TEAM_MAP[abbr?.toUpperCase()];
}

// ---- Free ESPN provider (default) ----
export class EspnProvider implements WinsProvider {
  name = "espn";
  async fetchWins(_: FetchOpts): Promise<WinsMap> {
    // Unofficial public JSON feed. Structure can change; code below is defensive.
    const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings", {
      headers: { "User-Agent": "wins-pool/1.0" },
      // ESPN doesn’t require headers, but UA helps some proxies
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`ESPN error ${res.status}`);

    const data: any = await res.json();
    const out: WinsMap = {};

    // Typical shape: data.children[] -> { name, standings: { entries: [...] } }
    const groups: any[] =
      Array.isArray(data?.children) ? data.children :
      Array.isArray(data?.standings?.groups) ? data.standings.groups :
      [];

    for (const g of groups) {
      const entries = g?.standings?.entries || g?.entries || [];
      for (const e of entries) {
        const team = e?.team || {};
        const abbr = team.abbreviation || team.abbrev || team.shortDisplayName || "";
        const id = normalizeTeamKey(abbr);
        if (!id) continue;

        // ESPN stats array; find wins by name
        const stats = Array.isArray(e?.stats) ? e.stats :
                      Array.isArray(team?.record?.items) ? team.record.items : [];
        let wins: number | undefined;

        // Try a few common shapes
        for (const s of stats) {
          const name = (s?.name || s?.type || "").toString().toLowerCase();
          if (name === "wins" || name === "overallwins" || name === "win") {
            wins = Number(s?.value ?? s?.displayValue ?? s?.summary);
            break;
          }
          // Some ESPN objects embed record like "10-6"
          if (!wins && typeof s?.displayValue === "string" && s.displayValue.includes("-")) {
            const m = s.displayValue.match(/^(\d+)-/);
            if (m) wins = Number(m[1]);
          }
        }

        // Fallback: look for overall record string on team
        if (wins == null && typeof e?.notes?.overall?.displayValue === "string") {
          const m = e.notes.overall.displayValue.match(/^(\d+)-/);
          if (m) wins = Number(m[1]);
        }

        out[id] = Math.max(0, Math.min(20, Number(wins ?? 0)));
      }
    }

    return out;
  }
}

// ---- Optional paid provider (kept) ----
class SportsDataIOProvider implements WinsProvider {
  name = "sportsdataio";
  async fetchWins({ season }: FetchOpts): Promise<WinsMap> {
    const key = process.env.WINS_PROVIDER_API_KEY;
    if (!key) throw new Error("WINS_PROVIDER_API_KEY missing");
    const yr = Number.isFinite(+season!) ? +season! : new Date().getFullYear();
    const url = `https://api.sportsdata.io/v3/nfl/scores/json/Standings/${yr}`;
    const res = await fetch(url, { headers: { "Ocp-Apim-Subscription-Key": key } });
    if (!res.ok) throw new Error(`SportsDataIO ${res.status}`);
    const rows = (await res.json()) as Array<{ Key: string; Wins: number }>;
    const out: WinsMap = {};
    for (const r of rows) {
      const id = normalizeTeamKey(r.Key);
      if (id) out[id] = Math.max(0, Math.min(20, Number(r.Wins || 0)));
    }
    return out;
  }
}

// ---- Mock (kept for local testing) ----
class MockProvider implements WinsProvider {
  name = "mock";
  async fetchWins(): Promise<WinsMap> {
    return { KC: 11, SF: 12, DAL: 9, PHI: 10, BUF: 10, BAL: 11 };
  }
}

// ---- Factory: default to ESPN ----
export function getWinsProvider(): WinsProvider {
  const p = (process.env.WINS_PROVIDER ?? "espn").toLowerCase();
  switch (p) {
    case "sportsdataio": return new SportsDataIOProvider();
    case "mock": return new MockProvider();
    case "espn":
    default: return new EspnProvider();
  }
}
