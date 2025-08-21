// lib/league.ts
import { prisma } from "@/lib/db";

export async function getLeagueByKey(key: string) {
  return (
    (await prisma.league.findUnique({ where: { id: key } })) ??
    (await prisma.league.findUnique({ where: { code: key } }))
  );
}
