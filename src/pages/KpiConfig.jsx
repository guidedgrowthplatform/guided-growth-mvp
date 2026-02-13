import { useState, useEffect } from 'react'
import { getMetrics, saveMetrics } from '../utils/storage'

const INPUT_TYPES = [
  { value: 'binary', label: 'Binary (Yes/No)' },
  { value: 'short_text', label: 'Short Text' },
  { value: 'numeric', label: 'Numeric' },
]

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'weekly', label: 'Weekly' },
]

export default function KpiConfig() {
  const [metrics, setMetrics] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    inputType: 'binary',
    question: '',
    active: true,
    frequency: 'daily',
  })

  useEffect(() => {
    setMetrics(getMetrics())
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    const newMetric = {
      id: editingId || Date.now().toString(),
      ...formData,
    }

    let updatedMetrics
    if (editingId) {
      updatedMetrics = metrics.map((m) =>
        m.id === editingId ? newMetric : m
      )
      setEditingId(null)
    } else {
      updatedMetrics = [...metrics, newMetric]
    }

    setMetrics(updatedMetrics)
    saveMetrics(updatedMetrics)
    setFormData({
      name: '',
      inputType: 'binary',
      question: '',
      active: true,
      frequency: 'daily',
    })
  }

  const handleEdit = (metric) => {
    setFormData(metric)
    setEditingId(metric.id)
  }

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this metric?')) {
      const updatedMetrics = metrics.filter((m) => m.id !== id)
      setMetrics(updatedMetrics)
      saveMetrics(updatedMetrics)
    }
  }

  const toggleActive = (id) => {
    const updatedMetrics = metrics.map((m) =>
      m.id === id ? { ...m, active: !m.active } : m
    )
    setMetrics(updatedMetrics)
    saveMetrics(updatedMetrics)
  }

  return (
    <div>
      <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent mb-8 pl-20">
        Configure Metrics
      </h1>

      {/* Form */}
      <div className="glass rounded-2xl shadow-xl border border-cyan-200/50 p-6 mb-8 glow-hover">
        <h2 className="text-xl font-semibold mb-4 text-slate-800">
          {editingId ? 'Edit Metric' : 'Add New Metric'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Metric Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-cyan-300/50 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 bg-white/80 backdrop-blur-sm transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Question/Phrase
            </label>
            <input
              type="text"
              value={formData.question}
              onChange={(e) =>
                setFormData({ ...formData, question: e.target.value })
              }
              className="w-full px-4 py-2 border border-cyan-300/50 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 bg-white/80 backdrop-blur-sm transition-all"
              placeholder="e.g., Did you exercise today?"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Input Type
              </label>
              <select
                value={formData.inputType}
                onChange={(e) =>
                  setFormData({ ...formData, inputType: e.target.value })
                }
                className="w-full px-4 py-2 border border-cyan-300/50 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 bg-white/80 backdrop-blur-sm transition-all"
              >
                {INPUT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Frequency
              </label>
              <select
                value={formData.frequency}
                onChange={(e) =>
                  setFormData({ ...formData, frequency: e.target.value })
                }
                className="w-full px-4 py-2 border border-cyan-300/50 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 bg-white/80 backdrop-blur-sm transition-all"
              >
                {FREQUENCIES.map((freq) => (
                  <option key={freq.value} value={freq.value}>
                    {freq.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={(e) =>
                setFormData({ ...formData, active: e.target.checked })
              }
              className="w-4 h-4 text-cyan-500 rounded focus:ring-cyan-400 accent-cyan-500"
            />
            <label htmlFor="active" className="text-sm font-medium text-slate-700">
              Active
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg glow-hover font-medium"
            >
              {editingId ? 'Update' : 'Add Metric'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null)
                  setFormData({
                    name: '',
                    inputType: 'binary',
                    question: '',
                    active: true,
                    frequency: 'daily',
                  })
                }}
                className="px-6 py-2 bg-slate-200/80 text-slate-700 rounded-xl hover:bg-slate-300/80 transition-all backdrop-blur-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Metrics List */}
      <div className="glass rounded-2xl shadow-xl border border-cyan-200/50">
        <div className="p-6 border-b border-cyan-200/30">
          <h2 className="text-xl font-semibold text-slate-800">Your Metrics</h2>
        </div>
        <div className="divide-y divide-cyan-200/30">
          {metrics.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No metrics configured yet. Add your first metric above.
            </div>
          ) : (
            metrics.map((metric) => (
              <div
                key={metric.id}
                className="p-6 hover:bg-cyan-50/30 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-800">
                        {metric.name}
                      </h3>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          metric.active
                            ? 'bg-emerald-200/80 text-emerald-800 border border-emerald-300/50'
                            : 'bg-slate-200/80 text-slate-600 border border-slate-300/50'
                        }`}
                      >
                        {metric.active ? 'Active' : 'Inactive'}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium bg-cyan-200/80 text-cyan-800 rounded border border-cyan-300/50">
                        {metric.frequency}
                      </span>
                    </div>
                    <p className="text-slate-600 mb-2">{metric.question}</p>
                    <div className="flex gap-4 text-sm text-slate-500">
                      <span>Type: {INPUT_TYPES.find((t) => t.value === metric.inputType)?.label}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleActive(metric.id)}
                      className="px-3 py-1 text-sm bg-slate-200/80 text-slate-700 rounded-lg hover:bg-slate-300/80 transition-all backdrop-blur-sm"
                    >
                      {metric.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleEdit(metric)}
                      className="px-3 py-1 text-sm bg-cyan-200/80 text-cyan-700 rounded-lg hover:bg-cyan-300/80 transition-all backdrop-blur-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(metric.id)}
                      className="px-3 py-1 text-sm bg-red-200/80 text-red-700 rounded-lg hover:bg-red-300/80 transition-all backdrop-blur-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

