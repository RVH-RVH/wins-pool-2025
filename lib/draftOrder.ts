// lib/draftOrder.ts
// key = pick number, value = "player slot" (1..5)
// NOTE: player slot 1 maps to the player with order === 0 in your DB, slot 2 → order 1, etc.
export const customDraftOrder: Record<number, 1|2|3|4|5> = {
  1:1, 10:1, 12:1, 20:1, 24:1, 26:1,
  2:2,  9:2, 14:2, 16:2, 23:2, 29:2,
  3:3,  8:3, 13:3, 17:3, 22:3, 30:3,
  4:4,  7:4, 11:4, 18:4, 25:4, 28:4,
  5:5,  6:5, 15:5, 19:5, 21:5, 27:5,
};

export function getPlayerSlotForPick(pickNumber: number): 1|2|3|4|5 | undefined {
  return customDraftOrder[pickNumber];
}

// convenience: get all picks for a slot (1..5)
export function getPicksForSlot(slot: 1|2|3|4|5): number[] {
  return Object.entries(customDraftOrder)
    .filter(([, s]) => s === slot)
    .map(([pick]) => Number(pick))
    .sort((a,b)=>a-b);
}
