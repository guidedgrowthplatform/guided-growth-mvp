import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Select } from '@/components/ui/Select';
import { useMetrics } from '@/hooks/useMetrics';
import { metricFormSchema, type MetricFormData } from '@/lib/validation';
import { INPUT_TYPES, FREQUENCIES } from '@shared/constants';

const emptyForm: MetricFormData = {
  name: '',
  input_type: 'binary',
  question: '',
  frequency: 'daily',
  active: true,
  target_value: '',
  target_unit: '',
};

export function ConfigurePage() {
  const { metrics, loading, create, update, remove } = useMetrics();
  const [editingId, setEditingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<MetricFormData>({
    resolver: zodResolver(metricFormSchema),
    defaultValues: emptyForm,
    mode: 'onBlur',
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const inputType = watch('input_type');

  const onSubmit = async (data: MetricFormData) => {
    const payload = {
      ...data,
      target_value: data.target_value ? parseFloat(data.target_value) : null,
      target_unit: data.target_unit || null,
    };
    if (editingId) {
      await update(editingId, payload);
      setEditingId(null);
    } else {
      await create(payload);
    }
    reset(emptyForm);
  };

  const handleEdit = (metric: (typeof metrics)[0]) => {
    reset({
      name: metric.name,
      input_type: metric.input_type,
      question: metric.question,
      frequency: metric.frequency,
      active: metric.active,
      target_value: metric.target_value != null ? String(metric.target_value) : '',
      target_unit: metric.target_unit || '',
    });
    setEditingId(metric.id);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this metric?')) {
      await remove(id);
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await update(id, { active: !active });
  };

  if (loading) return <LoadingSpinner className="h-64" />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary sm:mb-8 sm:text-3xl">
        Configure Metrics
      </h1>

      {/* Form */}
      <div className="mb-8 rounded-2xl border border-border bg-surface p-6 shadow-elevated">
        <h2 className="mb-4 text-xl font-semibold text-content">
          {editingId ? 'Edit Metric' : 'Add New Metric'}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Metric Name" {...register('name')} error={errors.name?.message} />
          <Input
            label="Question/Phrase"
            {...register('question')}
            placeholder="e.g., Did you exercise today?"
            error={errors.question?.message}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          {inputType === 'numeric' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Target Value"
                type="number"
                {...register('target_value')}
                placeholder="e.g., 10000"
              />
              <Input
                label="Target Unit"
                {...register('target_unit')}
                placeholder="e.g., steps, minutes, glasses"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              {...register('active')}
              className="h-4 w-4 rounded text-primary accent-primary focus:ring-primary"
            />
            <label htmlFor="active" className="text-sm font-medium text-content">
              Active
            </label>
          </div>

          <div className="flex gap-3">
            <Button type="submit">{editingId ? 'Update' : 'Add Metric'}</Button>
            {editingId && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditingId(null);
                  reset(emptyForm);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* Metrics List */}
      <div className="rounded-2xl border border-border bg-surface shadow-elevated">
        <div className="border-b border-border p-6">
          <h2 className="text-xl font-semibold text-content">Your Metrics</h2>
        </div>
        <div className="divide-y divide-border">
          {metrics.length === 0 ? (
            <div className="p-8 text-center text-content-secondary">No metrics configured yet.</div>
          ) : (
            metrics.map((metric) => (
              <div key={metric.id} className="p-4 transition-all hover:bg-surface-secondary sm:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-content">{metric.name}</h3>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${metric.active ? 'bg-success/20 text-success' : 'bg-surface-secondary text-content-secondary'}`}
                      >
                        {metric.active ? 'Active' : 'Inactive'}
                      </span>
                      <span className="rounded bg-surface-secondary px-2 py-0.5 text-xs font-medium text-primary">
                        {metric.frequency}
                      </span>
                    </div>
                    {metric.question && (
                      <p className="text-sm text-content-secondary">{metric.question}</p>
                    )}
                    <div className="mt-1 text-xs text-content-secondary">
                      Type: {INPUT_TYPES.find((t) => t.value === metric.input_type)?.label}
                      {metric.target_value != null && (
                        <span className="ml-2">
                          | Target: {metric.target_value}
                          {metric.target_unit ? ` ${metric.target_unit}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => toggleActive(metric.id, metric.active)}
                    >
                      {metric.active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleEdit(metric)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(metric.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
