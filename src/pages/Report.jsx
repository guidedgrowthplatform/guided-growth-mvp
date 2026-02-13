import { useState, useEffect } from 'react'
import { getMetrics, getAllEntries } from '../utils/storage'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parseISO } from 'date-fns'

export default function Report() {
  const [metrics, setMetrics] = useState([])
  const [entries, setEntries] = useState({})
  const [selectedDate, setSelectedDate] = useState(new Date())

  useEffect(() => {
    const activeMetrics = getMetrics().filter((m) => m.active)
    setMetrics(activeMetrics)
    setEntries(getAllEntries())
  }, [])

  const monthStart = startOfMonth(selectedDate)
  const monthEnd = endOfMonth(selectedDate)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  
  // Get first day of month to calculate offset
  const firstDayOfWeek = getDay(monthStart) // 0 = Sunday, 6 = Saturday
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  // Create array with empty cells for days before month starts
  const emptyCells = Array(firstDayOfWeek).fill(null)
  const allDays = [...emptyCells, ...daysInMonth]

  const getEntryForDate = (date, metricId) => {
    if (!date) return null
    const dateStr = format(date, 'yyyy-MM-dd')
    return entries[dateStr]?.[metricId]
  }

  const getCellValue = (date, metric) => {
    if (!date) return null
    const entry = getEntryForDate(date, metric.id)
    if (!entry) return '-'
    
    if (metric.inputType === 'binary') {
      return entry === 'yes' ? '1' : '0'
    }
    return entry
  }

  const getCellColor = (date, metric) => {
    if (!date) return 'bg-slate-100/30'
    const entry = getEntryForDate(date, metric.id)
    if (!entry) return 'bg-slate-100/30'

    const name = (metric?.name || '').toLowerCase()
    const normalized = name.replace(/[^a-z0-9]+/g, ' ').trim()
    const isBusinessDevHoursMetric =
      normalized.includes('business') &&
      normalized.includes('development') &&
      normalized.includes('hour')
    if (isBusinessDevHoursMetric) {
      const numValue = parseFloat(entry)
      if (!isNaN(numValue)) {
        return numValue > 0
          ? 'bg-emerald-400/80 text-white font-semibold'
          : 'bg-red-400/80 text-white font-semibold'
      }
    }
    
    if (metric.inputType === 'binary') {
      return entry === 'yes' 
        ? 'bg-emerald-400/80 text-white font-semibold' 
        : 'bg-red-400/80 text-white font-semibold'
    }
    
    // For numeric and text, use light green if has value
    if (entry && entry.toString().trim() !== '') {
      return 'bg-emerald-200/60 text-slate-800'
    }
    
    return 'bg-slate-100/30 text-slate-500'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pl-20">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
          Habit Tracker
        </h1>
        <input
          type="month"
          value={format(selectedDate, 'yyyy-MM')}
          onChange={(e) => setSelectedDate(parseISO(e.target.value + '-01'))}
          className="px-4 py-2 border border-cyan-300/50 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 bg-white/80 backdrop-blur-sm transition-all glass"
        />
      </div>

      {metrics.length === 0 ? (
        <div className="glass rounded-2xl shadow-xl border border-cyan-200/50 p-8 text-center text-slate-500">
          No metrics configured. Configure metrics first to view reports.
        </div>
      ) : (
        <div className="glass rounded-2xl shadow-xl border border-cyan-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-cyan-100/50 border-b-2 border-cyan-300/50">
                  <th className="sticky left-0 z-10 bg-cyan-100/50 px-4 py-3 text-left font-semibold text-slate-800 border-r-2 border-cyan-300/50 min-w-[200px]">
                    HABITS
                  </th>
                  {/* Day of week headers */}
                  {allDays.map((day, idx) => {
                    if (!day) {
                      return <th key={`empty-${idx}`} className="px-2 py-2 text-xs font-medium text-slate-600 bg-slate-100/30"></th>
                    }
                    const dayOfWeek = daysOfWeek[getDay(day)]
                    return (
                      <th key={day.toString()} className="px-2 py-2 text-center border-l border-cyan-200/30">
                        <div className="text-xs font-medium text-slate-600">{dayOfWeek}</div>
                        <div className="text-sm font-semibold text-slate-800">{format(day, 'd')}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric, metricIdx) => (
                  <tr 
                    key={metric.id} 
                    className={`border-b border-cyan-200/30 ${metricIdx % 2 === 0 ? 'bg-white/30' : 'bg-cyan-50/20'}`}
                  >
                    <td className="sticky left-0 z-10 px-4 py-3 text-sm font-medium text-slate-800 border-r-2 border-cyan-300/50 bg-inherit">
                      <div className="font-semibold">{metric.name}</div>
                      {metric.question && (
                        <div className="text-xs text-slate-600 mt-1">{metric.question}</div>
                      )}
                    </td>
                    {allDays.map((day, dayIdx) => {
                      const value = getCellValue(day, metric)
                      const cellColor = getCellColor(day, metric)
                      
                      return (
                        <td
                          key={day ? day.toString() : `empty-${dayIdx}`}
                          className={`px-2 py-2 text-center text-xs border-l border-cyan-200/30 ${cellColor} min-w-[40px]`}
                        >
                          {value}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Legend */}
          <div className="p-4 bg-cyan-50/30 border-t border-cyan-200/30 flex gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-emerald-400/80"></div>
              <span className="text-slate-700">Completed (1/Yes)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-red-400/80"></div>
              <span className="text-slate-700">Not Completed (0/No)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-emerald-200/60"></div>
              <span className="text-slate-700">Has Value</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-slate-100/30"></div>
              <span className="text-slate-700">No Entry (-)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
