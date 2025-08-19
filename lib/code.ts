// Generates a short, readable code like "FOX-7QK" (no ambiguous chars)
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O
const NUMS  = "23456789";                 // no 0/1
const WORDS = ["NFL"];

function rand(n: number) { return Math.floor(Math.random() * n); }
function pick(s: string) { return s[rand(s.length)]; }

export function makeLeagueCode(): string {
  const w = WORDS[rand(WORDS.length)];
  const suffix = [0,1,2].map(() => pick(ALPHA + NUMS)).join("");
  return `${w}-${suffix}`;
}

