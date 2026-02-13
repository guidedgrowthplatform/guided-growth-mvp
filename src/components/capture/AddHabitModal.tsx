import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { INPUT_TYPES, FREQUENCIES } from '@shared/constants';
import type { MetricCreate } from '@shared/types';

interface AddHabitModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: MetricCreate) => void;
}

export function AddHabitModal({ open, onClose, onAdd }: AddHabitModalProps) {
  const [form, setForm] = useState<MetricCreate>({
    name: '',
    question: '',
    input_type: 'binary',
    frequency: 'daily',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onAdd(form);
    setForm({ name: '', question: '', input_type: 'binary', frequency: 'daily' });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add New Habit">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Habit Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <Input label="Question (optional)" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Input Type" value={form.input_type} onChange={(e) => setForm({ ...form, input_type: e.target.value as any })} options={INPUT_TYPES} />
          <Select label="Frequency" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as any })} options={FREQUENCIES} />
        </div>
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Add Habit</Button>
        </div>
      </form>
    </Modal>
  );
}
