import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { INPUT_TYPES, FREQUENCIES } from '@shared/constants';
import { metricCreateSchema, type MetricCreateForm } from '@/lib/validation';
import type { MetricCreate } from '@shared/types';

interface AddHabitModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: MetricCreate) => void;
}

const defaultValues: MetricCreateForm = {
  name: '',
  question: '',
  input_type: 'binary',
  frequency: 'daily',
};

export function AddHabitModal({ open, onClose, onAdd }: AddHabitModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MetricCreateForm>({
    resolver: zodResolver(metricCreateSchema),
    defaultValues,
  });

  const onSubmit = (data: MetricCreateForm) => {
    onAdd(data);
    reset(defaultValues);
    onClose();
  };

  const handleClose = () => {
    reset(defaultValues);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Add New Habit">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Habit Name" {...register('name')} error={errors.name?.message} />
        <Input
          label="Question (optional)"
          {...register('question')}
          error={errors.question?.message}
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Input Type"
            {...register('input_type')}
            options={INPUT_TYPES}
            error={errors.input_type?.message}
          />
          <Select
            label="Frequency"
            {...register('frequency')}
            options={FREQUENCIES}
            error={errors.frequency?.message}
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit">Add Habit</Button>
        </div>
      </form>
    </Modal>
  );
}
