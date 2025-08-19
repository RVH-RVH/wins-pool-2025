// lib/pusher.ts
import Pusher from "pusher";

export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: process.env.PUSHER_USE_TLS !== "false",
});

export function emitLeagueUpdate(leagueId: string, payload: any = { type: "updated" }) {
  // channel: league-<id>, event: "updated"
  return pusher.trigger(`league-${leagueId}`, "updated", payload);
}
