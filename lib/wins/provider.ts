



export function getWinsProvider(): WinsProvider {
  const p = (process.env.WINS_PROVIDER ?? "espn").toLowerCase();
  switch (p) {
    // case "sportsdataio": return new SportsDataIOProvider();
    case "espn":
    default: return new EspnProvider();
  }
}
export type WinsMap = Record<string, number>;
export type FetchOpts = { season?: number; week?: number };
export interface WinsProvider {
  name: string;
  fetchWins(opts: FetchOpts): Promise<WinsMap>;
}

function normalizeTeamKey(abbr: string): string | null {
  if (!abbr) return null;
  const up = abbr.toUpperCase();
  const ALIASES: Record<string, string> = {
    LAR: "LA",
    JAC: "JAX",
    WSH: "WAS",
    ARZ: "ARI",
    SD:  "LAC",
    OAK: "LV",
  };
  return ALIASES[up] ?? up;
}

async function getJson(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "wins-pool/1.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${url}`);
  return res.json();
}

export class EspnProvider implements WinsProvider {
  name = "espn";

  async fetchWins({ season }: FetchOpts): Promise<WinsMap> {
    const year = Number.isFinite(+season!) ? +season! : new Date().getFullYear();

    // 1) Get the season’s team collection
    // Example: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/teams
    const teamsRoot = await getJson(
      `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${year}/teams`
    );

    const teamItems: any[] = Array.isArray(teamsRoot?.items) ? teamsRoot.items : [];
    if (!teamItems.length) {
      console.warn("[ESPN] No teams returned for season", year);
      return {};
    }

    // 2) For each team, fetch its record for regular season (type=2)
    // Example: team doc $ref -> has abbreviation
    // Record endpoint pattern:
    //   https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${year}/types/2/teams/{teamId}/record
    const CONCURRENCY = 8;
    const chunks = Array.from({ length: Math.ceil(teamItems.length / CONCURRENCY) }, (_, i) =>
      teamItems.slice(i * CONCURRENCY, (i + 1) * CONCURRENCY)
    );

    const out: WinsMap = {};

    for (const chunk of chunks) {
      const results = await Promise.all(
        chunk.map(async (item) => {
          try {
            const teamDoc = item?.$ref ? await getJson(item.$ref) : item;
            const teamId = teamDoc?.id; // numeric
            const abbr =
              teamDoc?.abbreviation ||
              teamDoc?.shortDisplayName ||
              teamDoc?.displayName ||
              "";
            const norm = normalizeTeamKey(abbr || "");
            if (!norm) return null;

            const recordUrl = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${year}/types/2/teams/${teamId}/record`;
            const recordDoc = await getJson(recordUrl);

            // recordDoc.items[0].stats -> look for wins
            const recordItems: any[] = Array.isArray(recordDoc?.items)
              ? recordDoc.items
              : [];
            let wins: number | undefined;

            if (recordItems.length) {
              // follow first item if it’s a $ref
              const rec = recordItems[0]?.$ref
                ? await getJson(recordItems[0].$ref)
                : recordItems[0];

              const stats: any[] = Array.isArray(rec?.stats) ? rec.stats : [];
              for (const s of stats) {
                const name = String(s?.name ?? s?.type ?? "").toLowerCase();
                if (name === "wins" || name === "overallwins" || name === "win") {
                  wins = Number(s?.value ?? s?.displayValue ?? s?.summary);
                  break;
                }
                // Sometimes only a "10-7" style record is present:
                if (!wins && typeof s?.displayValue === "string") {
                  const m = s.displayValue.match(/^(\d+)-/);
                  if (m) wins = Number(m[1]);
                }
              }
            }

            return { id: norm, wins: Math.max(0, Math.min(20, Number(wins ?? 0))) };
          } catch (e) {
            // swallow individual team errors so one bad team doesn't kill the whole fetch
            return null;
          }
        })
      );

      for (const row of results) {
        if (row && row.id) out[row.id] = row.wins ?? 0;
      }
    }

    // Optional: log summary
    // console.log("[ESPN] fetched teams:", Object.keys(out).length, "sample:", Object.entries(out).slice(0,5));

    return out;
  }
}