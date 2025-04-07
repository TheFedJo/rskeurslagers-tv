
// --- src/types.ts ---
export type Player = {
  id: string;
  name: string;
  elo: number;
};

export type Match = {
  id: string;
  type: '1v1' | '2v2';
  players: string[]; // always 4 slots; for 1v1: [p1, null, p2, null]
  winner: 'team1' | 'team2';
  date: string;
};

