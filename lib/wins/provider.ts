export type WinsMap = Record<string, number>;
export type FetchOpts = { season?: number; week?: number };
export interface WinsProvider { name: string; fetchWins(opts: FetchOpts): Promise<WinsMap>; }


// Hardcoded map from ESPN team abbreviations to internal 3-letter IDs
const ESPN_TEAM_MAP: Record<string, string> = {
  ARI: "ari", ATL: "atl", BAL: "bal", BUF: "buf", CAR: "car",
  CHI: "chi", CIN: "cin", CLE: "cle", DAL: "dal", DEN: "den",
  DET: "det", GB: "gb", HOU: "hou", IND: "ind", JAX: "jax",
  KC: "kc", LV: "lv", LAC: "lac", LAR: "lar", MIA: "mia",
  MIN: "min", NE: "ne", NO: "no", NYG: "nyg", NYJ: "nyj",
  PHI: "phi", PIT: "pit", SF: "sf", SEA: "sea", TB: "tb",
  TEN: "ten", WSH: "wsh",
};

function normalizeTeamKey(abbr: string): string | undefined {
  return ESPN_TEAM_MAP[abbr?.toUpperCase()];
}

export class EspnProvider implements WinsProvider {
  name = "espn";

  async fetchWins(_: FetchOpts): Promise<WinsMap> {
    console.log("🌐 Fetching NFL scoreboard from ESPN...");
    const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard", {
      headers: { "User-Agent": "wins-pool/1.0" },
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`ESPN scoreboard error ${res.status}`);

    const json: any = await res.json();
    const out: WinsMap = {};

    const events = json?.events ?? [];
    console.log(`📊 Parsing ${events.length} ESPN events...`);

    for (const event of events) {
      const competitors = event?.competitions?.[0]?.competitors ?? [];

      for (const c of competitors) {
        const abbr = c?.team?.abbreviation || "";
        const id = normalizeTeamKey(abbr);
        if (!id) continue;

        let wins = 0;
        const records = c?.records ?? [];

        for (const r of records) {
          const summary = r?.summary;
          if (typeof summary === "string" && summary.includes("-")) {
            const match = summary.match(/^(\d+)-/);
            if (match) {
              wins = Number(match[1]);
              break;
            }
          }
        }

        out[id] = Math.max(out[id] ?? 0, wins); // Keep highest if seen multiple times
      }
    }

    console.log("✅ Fetched win totals:", out);
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
