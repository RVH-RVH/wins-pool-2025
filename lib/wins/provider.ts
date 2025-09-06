



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
// 🟢 NEW: fetch all pages from a v2 collection
async function fetchAllItems(url: string) {
  const items: any[] = [];
  let page = 1;
  // add page=… until pageCount reached (25 per page typical)
  // works whether or not the URL already has a query string
  for (;;) {
    const sep = url.includes("?") ? "&" : "?";
    const doc = await getJson(`${url}${sep}page=${page}`);
    const batch: any[] = Array.isArray(doc?.items) ? doc.items : [];
    items.push(...batch);
    const pageCount = Number(doc?.pageCount ?? 1);
    if (page >= pageCount || batch.length === 0) break;
    page++;
  }
  return items;
}
async function fetchAllV2Items(url: string) {
  const items: any[] = [];
  // ask nicely for more per page; ESPN ignores it sometimes but often honors it
  const base = url.includes("?") ? `${url}&limit=1000` : `${url}?limit=1000`;
  let nextUrl: string | null = base;
  let guard = 0;

  while (nextUrl && guard++ < 20) {
    const doc = await getJson(nextUrl);
    const batch: any[] = Array.isArray(doc?.items) ? doc.items : [];
    items.push(...batch);

    // Prefer HAL-style "next" link if present
    const linkNext = Array.isArray(doc?.links)
      ? doc.links.find((l: any) => Array.isArray(l?.rel) ? l.rel.includes("next") : l?.rel === "next")
      : null;

    if (linkNext?.href) {
      nextUrl = linkNext.href;
      continue;
    }

    // Fallback to pageCount/pageIndex if available
    const pageIndex = Number(doc?.pageIndex ?? 0);   // 1-based or 0-based varies; we’ll compute conservatively
    const pageCount = Number(doc?.pageCount ?? 1);

    // If there are more pages but no link, try incrementing `page`
    if (pageCount && pageIndex && pageIndex < pageCount) {
      const sep = base.includes("?") ? "&" : "?";
      nextUrl = `${base}${sep}page=${pageIndex + 1}`;
    } else if (pageCount && !pageIndex && items.length && batch.length === 25) {
      // Some docs omit pageIndex; keep going until we get <25 items
      const currentPage = (items.length / 25) + 1;
      const sep = base.includes("?") ? "&" : "?";
      nextUrl = `${base}${sep}page=${currentPage}`;
    } else {
      nextUrl = null;
    }
  }

  return items;
}

export class EspnProvider implements WinsProvider {
  name = "espn";

  async fetchWins({ season }: FetchOpts): Promise<WinsMap> {
    const year = Number.isFinite(+season!) ? +season! : new Date().getFullYear();

        // 🟢 GET ALL TEAMS (not just first 25)
    const teamsUrl = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${year}/teams`;
    const teamItems: any[] = await fetchAllV2Items(teamsUrl);

    console.log("[ESPN] teams fetched:", teamItems.length); // expect 32

    
  
    // 1) Get the season’s team collection
    // Example: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/teams
    const teamsRoot = await getJson(
      `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${year}/teams`
    );

 
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