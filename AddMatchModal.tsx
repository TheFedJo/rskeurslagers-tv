

// --- src/components/AddMatchModal.tsx ---
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { calculateElo } from '@/lib/elo';

export function AddMatchModal({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const [players, setPlayers] = useState([]);
  const [playerIds, setPlayerIds] = useState<string[]>(['', '', '', '']);
  const [type, setType] = useState<'1v1' | '2v2'>('1v1');
  const [winner, setWinner] = useState<'team1' | 'team2'>('team1');

  useEffect(() => {
    supabase.from('players').select().then(({ data }) => setPlayers(data || []));
  }, []);

  async function handleSubmit() {
    const date = new Date().toISOString();
    await supabase.from('matches').insert([{
      type,
      players: playerIds,
      winner,
      date
    }]);

    // Fetch current elos and apply calculation logic
    const ids = winner === 'team1' ? [playerIds[0], playerIds[1]] : [playerIds[2], playerIds[3]];
    const losers = winner === 'team1' ? [playerIds[2], playerIds[3]] : [playerIds[0], playerIds[1]];

    const all = [...ids, ...losers];
    const { data: dbPlayers } = await supabase.from('players').select().in('id', all);

    if (!dbPlayers) return;

    const newElos = {};
    for (let i = 0; i < 2; i++) {
      const [newW, newL] = calculateElo(
        dbPlayers.find(p => p.id === ids[i])?.elo ?? 1000,
        dbPlayers.find(p => p.id === losers[i])?.elo ?? 1000
      );
      newElos[ids[i]] = newW;
      newElos[losers[i]] = newL;
    }

    await Promise.all(
      Object.entries(newElos).map(([id, elo]) =>
        supabase.from('players').update({ elo }).eq('id', id)
      )
    );

    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>Add Match</DialogHeader>
        <select value={type} onChange={e => setType(e.target.value as '1v1' | '2v2')}>
          <option value="1v1">1v1</option>
          <option value="2v2">2v2</option>
        </select>
        {[0, 1, 2, 3].map(i => (
          <select key={i} value={playerIds[i]} onChange={e => {
            const newIds = [...playerIds];
            newIds[i] = e.target.value;
            setPlayerIds(newIds);
          }}>
            <option value="">Select Player</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        ))}
        <select value={winner} onChange={e => setWinner(e.target.value as 'team1' | 'team2')}>
          <option value="team1">Team 1</option>
          <option value="team2">Team 2</option>
        </select>
        <Button onClick={handleSubmit}>Submit</Button>
      </DialogContent>
    </Dialog>
  );
}
