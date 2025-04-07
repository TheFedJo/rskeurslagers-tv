
// --- src/components/AddPlayerModal.tsx ---
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function AddPlayerModal({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const [name, setName] = useState('');

  async function handleSubmit() {
    await supabase.from('players').insert([{ name, elo: 1000 }]);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>Add Player</DialogHeader>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
        <Button onClick={handleSubmit}>Submit</Button>
      </DialogContent>
    </Dialog>
  );
}
