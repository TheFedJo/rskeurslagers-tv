
// --- src/lib/elo.ts ---
export function calculateElo(winnerElo: number, loserElo: number, k = 32) {
  const expected = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const winnerNew = Math.round(winnerElo + k * (1 - expected));
  const loserNew = Math.round(loserElo - k * (1 - expected));
  return [winnerNew, loserNew];
}

