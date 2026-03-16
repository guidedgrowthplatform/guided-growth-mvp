import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMetrics } from '@/hooks/useMetrics';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { INPUT_TYPES, FREQUENCIES } from '@shared/constants';
import { metricFormSchema, type MetricFormData } from '@/lib/validation';

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

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<MetricFormData>({
    resolver: zodResolver(metricFormSchema),
    defaultValues: emptyForm,
  });

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

  const handleEdit = (metric: typeof metrics[0]) => {
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
      <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-6 sm:mb-8">
        Configure Metrics
      </h1>

      {/* Form */}
      <div className="bg-surface shadow-elevated border border-border rounded-2xl p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-content">
          {editingId ? 'Edit Metric' : 'Add New Metric'}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Metric Name"
            {...register('name')}
            error={errors.name?.message}
          />
          <Input
            label="Question/Phrase"
            {...register('question')}
            placeholder="e.g., Did you exercise today?"
            error={errors.question?.message}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              className="w-4 h-4 text-primary rounded focus:ring-primary accent-primary"
            />
            <label htmlFor="active" className="text-sm font-medium text-content">Active</label>
          </div>

          <div className="flex gap-3">
            <Button type="submit">{editingId ? 'Update' : 'Add Metric'}</Button>
            {editingId && (
              <Button type="button" variant="secondary" onClick={() => { setEditingId(null); reset(emptyForm); }}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* Metrics List */}
      <div className="bg-surface shadow-elevated border border-border rounded-2xl">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-content">Your Metrics</h2>
        </div>
        <div className="divide-y divide-border">
          {metrics.length === 0 ? (
            <div className="p-8 text-center text-content-secondary">No metrics configured yet.</div>
          ) : (
            metrics.map((metric) => (
              <div key={metric.id} className="p-4 sm:p-6 hover:bg-surface-secondary transition-all">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-content">{metric.name}</h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${metric.active ? 'bg-success/20 text-success' : 'bg-surface-secondary text-content-secondary'}`}>
                        {metric.active ? 'Active' : 'Inactive'}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium bg-surface-secondary text-primary rounded">{metric.frequency}</span>
                    </div>
                    {metric.question && <p className="text-content-secondary text-sm">{metric.question}</p>}
                    <div className="text-xs text-content-secondary mt-1">
                      Type: {INPUT_TYPES.find((t) => t.value === metric.input_type)?.label}
                      {metric.target_value != null && (
                        <span className="ml-2">
                          | Target: {metric.target_value}{metric.target_unit ? ` ${metric.target_unit}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => toggleActive(metric.id, metric.active)}>
                      {metric.active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleEdit(metric)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(metric.id)}>Delete</Button>
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
