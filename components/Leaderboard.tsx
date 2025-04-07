

// --- src/components/Leaderboard.tsx ---
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Player } from '@/types';

export function Leaderboard() {
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    supabase.from('players').select('*').order('elo', { ascending: false }).then(({ data }) => {
      if (data) setPlayers(data);
    });
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">Leaderboard</h2>
      <ul>
        {players.map(p => (
          <li key={p.id} className="mb-1">{p.name} — {p.elo}</li>
        ))}
      </ul>
    </div>
  );
}
