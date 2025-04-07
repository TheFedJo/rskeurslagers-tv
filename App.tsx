

// --- src/App.tsx ---
import { useState } from 'react';
import { AddPlayerModal } from '@/components/AddPlayerModal';
import { AddMatchModal } from '@/components/AddMatchModal';
import { Leaderboard } from '@/components/Leaderboard';
import { Button } from '@/components/ui/button';

function App() {
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);

  return (
    <main className="p-4">
      <h1 className="text-3xl font-bold mb-4">Elo Tracker</h1>
      <div className="flex gap-2 mb-4">
        <Button onClick={() => setShowPlayerModal(true)}>Add Player</Button>
        <Button onClick={() => setShowMatchModal(true)}>Add Match</Button>
      </div>
      <Leaderboard />
      <AddPlayerModal open={showPlayerModal} setOpen={setShowPlayerModal} />
      <AddMatchModal open={showMatchModal} setOpen={setShowMatchModal} />
    </main>
  );
}

export default App;
