


export type WinsMap = Record<string, number>;
export type FetchOpts = { season?: number; week?: number };
export interface WinsProvider { name: string; fetchWins(opts: FetchOpts): Promise<WinsMap>; }



function normTeamId(id: string): string {
  const up = (id || "").toUpperCase();
  const ALIASES: Record<string, string> = {
    LAR: "LA",
    JAC: "JAX",
    WSH: "WAS",
    ARZ: "ARI",
    OAK: "LV",
    SD:  "LAC",
  };
  return ALIASES[up] ?? up;
}

async function getJson(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": "wins-pool/1.0" }, cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${url}`);
  return res.json();
}

async function pullStandings(season: number, groupId: number) {
  // core v2; 2=regular season; groups: AFC=8, NFC=9
  const url = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${season}/types/2/groups/${groupId}/standings?level=2`;
  return getJson(url);
}

export class EspnProvider implements WinsProvider {
  name = "espn";

  async fetchWins({ season }: FetchOpts): Promise<WinsMap> {
    const year = Number.isFinite(+season!) ? +season! : new Date().getFullYear();

    const [afcRoot, nfcRoot] = await Promise.all([pullStandings(year, 8), pullStandings(year, 9)]);

    const extract = async (doc: any) => {
      const entriesUrl =
        doc?.children?.find?.((c: any) => c?.rel?.includes?.("standingsEntries"))?.href ||
        doc?.standings?.$ref || doc?.$ref || doc?.href;

      const entriesDoc = entriesUrl ? await getJson(entriesUrl) : null;
      const items: any[] = Array.isArray(entriesDoc?.items) ? entriesDoc.items : [];

      const out: Array<{ id: string; wins: number }> = [];
      for (const item of items) {
        const entry = item?.$ref ? await getJson(item.$ref) : item;

        let abbr = "";
        try {
          const teamDoc = entry?.team?.$ref ? await getJson(entry.team.$ref) : entry?.team;
          abbr = teamDoc?.abbreviation || teamDoc?.shortDisplayName || teamDoc?.displayName || "";
        } catch {}

        const id = normTeamId(abbr || "");
        if (!id) continue;

        const stats: any[] = Array.isArray(entry?.stats) ? entry.stats : [];
        let wins: number | undefined;

        for (const s of stats) {
          const name = String(s?.name ?? s?.type ?? "").toLowerCase();
          if (name === "wins" || name === "overallwins" || name === "win") {
            wins = Number(s?.value ?? s?.displayValue ?? s?.summary);
            break;
          }
          if (!wins && typeof s?.displayValue === "string") {
            const m = s.displayValue.match(/^(\d+)-/);
            if (m) wins = Number(m[1]);
          }
        }

        out.push({ id, wins: Math.max(0, Math.min(20, Number(wins ?? 0))) });
      }
      return out;
    };

    const [afc, nfc] = await Promise.all([extract(afcRoot), extract(nfcRoot)]);
    const result: WinsMap = {};
    for (const row of [...afc, ...nfc]) result[row.id] = row.wins;

    return result; // <- caller (sync route) will name this `latest`
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
   const ALIASES: Record<string,string> = { 
  LAR:"LA", JAC:"JAX", WSH:"WAS", ARZ:"ARI", SD:"LAC", OAK:"LV" 
};
const id = ALIASES[r.Key] ?? r.Key;
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
