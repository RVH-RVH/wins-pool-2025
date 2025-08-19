import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const LEAGUE_ID = "cmef1a1r30002ic9026ewfdgt"; // league to delete

async function main() {
  console.log(`Deleting league ${LEAGUE_ID} and related data...`);

  await prisma.pick.deleteMany({ where: { leagueId: LEAGUE_ID } });
  await prisma.player.deleteMany({ where: { leagueId: LEAGUE_ID } });
  await prisma.teamWin.deleteMany({ where: { leagueId: LEAGUE_ID } });
  await prisma.league.delete({ where: { id: LEAGUE_ID } });

  console.log("✅ League and related records deleted.");
}

main()
  .catch((e) => {
    console.error("Error deleting league:", e);
  })
  .finally(() => prisma.$disconnect());
