import { format, parseISO, isWeekend, getDay, startOfWeek, endOfWeek, isWithinInterval, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import { getCurrentUserId } from './users'

// Helper function to capitalize first letter of each word in habit names
export function capitalizeHabitName(name) {
  if (!name) return name
  return name
    .split(' ')
    .map(word => {
      // Handle special cases like parentheses, slashes, numbers
      if (word.includes('(') || word.includes('/') || word.includes(')')) {
        // Capitalize first letter, preserve rest
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      }
      // Regular word: capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

const METRICS_KEY_PREFIX = 'life_tracker_metrics_'
const ENTRIES_KEY_PREFIX = 'life_tracker_entries_'
const REFLECTIONS_KEY_PREFIX = 'life_tracker_reflections_'
const REFLECTION_CONFIG_KEY_PREFIX = 'life_tracker_reflection_config_'
const AFFIRMATION_KEY_PREFIX = 'life_tracker_affirmation_'

function getMetricsKey(userId) {
  return `${METRICS_KEY_PREFIX}${userId}`
}

function getEntriesKey(userId) {
  return `${ENTRIES_KEY_PREFIX}${userId}`
}

// Sample metrics for first-time users
const SAMPLE_METRICS = [
  {
    id: '1',
    name: 'Exercise',
    inputType: 'binary',
    question: 'Did you exercise today?',
    active: true,
    frequency: 'daily',
  },
  {
    id: '2',
    name: 'Water Intake',
    inputType: 'numeric',
    question: 'How many glasses of water did you drink?',
    active: true,
    frequency: 'daily',
  },
  {
    id: '3',
    name: 'Gratitude',
    inputType: 'short_text',
    question: 'What are you grateful for today?',
    active: true,
    frequency: 'daily',
  },
  {
    id: '4',
    name: 'Weekly Review',
    inputType: 'short_text',
    question: 'How was your week?',
    active: true,
    frequency: 'weekly',
  },
]

export function initializeSampleData(userId = null) {
  const currentUserId = userId || getCurrentUserId()
  if (!currentUserId) return
  
  const metricsKey = getMetricsKey(currentUserId)
  const entriesKey = getEntriesKey(currentUserId)
  
  if (!localStorage.getItem(metricsKey)) {
    saveMetrics(SAMPLE_METRICS, currentUserId)
  }
  
  // Generate sample entries if none exist
  if (!localStorage.getItem(entriesKey)) {
    generateSampleEntries(currentUserId)
  }
}

function generateSampleEntries(userId = null) {
  const currentUserId = userId || getCurrentUserId()
  if (!currentUserId) return
  
  const entries = {}
  const today = new Date()
  const metrics = getMetrics(currentUserId)
  
  // Generate data for the last 30 days
  for (let i = 0; i < 30; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayEntries = {}
    
    metrics.forEach((metric) => {
      if (!metric.active) return
      
      // Skip if not due for this date
      if (!isMetricDue(metric, dateStr)) {
        return
      }
      
      // Generate realistic sample data with some variation
      const dayOfWeek = getDay(date)
      const random = Math.random()
      const dayNumber = date.getDate()
      
      // Create some patterns (e.g., better performance on certain days)
      const performanceFactor = (dayNumber % 7) / 7 // Creates a pattern
      
      switch (metric.inputType) {
        case 'binary':
          // More likely to be "yes" on weekdays, less on weekends
          // Add some variation - not all days are the same
          const binaryThreshold = (dayOfWeek >= 1 && dayOfWeek <= 5) 
            ? 0.15 + performanceFactor * 0.1  // 15-25% chance of "no" on weekdays
            : 0.35 + performanceFactor * 0.15  // 35-50% chance of "no" on weekends
          dayEntries[metric.id] = random > binaryThreshold ? 'yes' : 'no'
          break
        case 'numeric':
          // Generate numbers based on metric name with realistic variation
          if (metric.name.toLowerCase().includes('water')) {
            const base = 5
            const variation = Math.floor(Math.random() * 5) // 0-4
            dayEntries[metric.id] = base + variation // 5-9 glasses
          } else if (metric.name.toLowerCase().includes('hour')) {
            const hours = (Math.random() * 3 + 0.5).toFixed(1) // 0.5-3.5 hours
            dayEntries[metric.id] = parseFloat(hours) > 0.5 ? hours : '0.5'
          } else {
            // Random number between 1-100, but with some days missing
            if (random > 0.2) {
              dayEntries[metric.id] = Math.floor(Math.random() * 50) + 1
            }
          }
          break
        case 'short_text':
          // Only fill some days (70% fill rate)
          if (random > 0.3) {
            const sampleTexts = [
              'Great day!',
              'Feeling good',
              'Productive',
              'Challenging but rewarding',
              'Need improvement'
            ]
            dayEntries[metric.id] = sampleTexts[Math.floor(Math.random() * sampleTexts.length)]
          }
          break
      }
    })
    
  if (Object.keys(dayEntries).length > 0) {
      entries[dateStr] = dayEntries
    }
  }
  
  const entriesKey = getEntriesKey(currentUserId)
  localStorage.setItem(entriesKey, JSON.stringify(entries))
}

export function getMetrics(userId = null) {
  const currentUserId = userId || getCurrentUserId()
  if (!currentUserId) return []
  const metricsKey = getMetricsKey(currentUserId)
  const stored = localStorage.getItem(metricsKey)
  return stored ? JSON.parse(stored) : []
}

export function saveMetrics(metrics, userId = null) {
  const currentUserId = userId || getCurrentUserId()
  if (!currentUserId) return
  const metricsKey = getMetricsKey(currentUserId)
  localStorage.setItem(metricsKey, JSON.stringify(metrics))
}

export function getEntry(date, userId = null) {
  const entries = getAllEntries(userId)
  return entries[date] || null
}

export function saveEntry(date, entryData, userId = null) {
  const currentUserId = userId || getCurrentUserId()
  if (!currentUserId) return
  const entries = getAllEntries(currentUserId)
  entries[date] = entryData
  const entriesKey = getEntriesKey(currentUserId)
  localStorage.setItem(entriesKey, JSON.stringify(entries))
}

export function getAllEntries(userId = null) {
  const currentUserId = userId || getCurrentUserId()
  if (!currentUserId) return {}
  const entriesKey = getEntriesKey(currentUserId)
  const stored = localStorage.getItem(entriesKey)
  return stored ? JSON.parse(stored) : {}
}

export function isMetricDue(metric, dateStr) {
  const date = parseISO(dateStr)
  const dayOfWeek = getDay(date) // 0 = Sunday, 6 = Saturday

  switch (metric.frequency) {
    case 'daily':
      return true
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5
    case 'weekends':
      return dayOfWeek === 0 || dayOfWeek === 6
    case 'weekly':
      // For weekly, show if it's the first day of the week (Monday) or if there's no entry for this week
      if (dayOfWeek === 1) return true
      const weekStart = startOfWeek(date, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 })
      // Note: isMetricDue is called from contexts that may not have userId, 
      // so we use getCurrentUserId() as fallback
      const entries = getAllEntries(getCurrentUserId())
      
      // Check if there's any entry for this week
      for (let d = weekStart; d <= weekEnd; d.setDate(d.getDate() + 1)) {
        const dateKey = format(d, 'yyyy-MM-dd')
        if (entries[dateKey]?.[metric.id]) {
          return false // Already has entry this week
        }
      }
      return true
    default:
      return true
  }
}

// Reflection fields storage functions
function getReflectionsKey(userId) {
  return `${REFLECTIONS_KEY_PREFIX}${userId}`
}

function getReflectionConfigKey(userId) {
  return `${REFLECTION_CONFIG_KEY_PREFIX}${userId}`
}

function getAffirmationKey(userId) {
  return `${AFFIRMATION_KEY_PREFIX}${userId}`
}

// Default reflection configuration
const DEFAULT_REFLECTION_CONFIG = {
  fields: [
    { id: '1', label: 'PROUD', order: 0 },
    { id: '2', label: 'FORGIVE', order: 1 },
    { id: '3', label: 'GRATEFUL', order: 2 }
  ],
  showAffirmation: true
}

export function getReflectionConfig(userId = null) {
  const currentUserId = userId || getCurrentUserId()
  if (!currentUserId) return DEFAULT_REFLECTION_CONFIG
  const configKey = getReflectionConfigKey(currentUserId)
  const stored = localStorage.getItem(configKey)
  return stored ? JSON.parse(stored) : DEFAULT_REFLECTION_CONFIG
}

export function saveReflectionConfig(config, userId = null) {
  const currentUserId = userId || getCurrentUserId()
  if (!currentUserId) return
  const configKey = getReflectionConfigKey(currentUserId)
  localStorage.setItem(configKey, JSON.stringify(config))
}

export function getReflections(date, userId = null) {
  const currentUserId = userId || getCurrentUserId()
  if (!currentUserId) return {}
  const reflectionsKey = getReflectionsKey(currentUserId)
  const stored = localStorage.getItem(reflectionsKey)
  const allReflections = stored ? JSON.parse(stored) : {}
  return allReflections[date] || {}
}

export function saveReflections(date, reflectionData, userId = null) {
  const currentUserId = userId || getCurrentUserId()
  if (!currentUserId) return
  const reflectionsKey = getReflectionsKey(currentUserId)
  const stored = localStorage.getItem(reflectionsKey)
  const allReflections = stored ? JSON.parse(stored) : {}
  allReflections[date] = reflectionData
  localStorage.setItem(reflectionsKey, JSON.stringify(allReflections))
}

export function getAllReflections(userId = null) {
  const currentUserId = userId || getCurrentUserId()
  if (!currentUserId) return {}
  const reflectionsKey = getReflectionsKey(currentUserId)
  const stored = localStorage.getItem(reflectionsKey)
  return stored ? JSON.parse(stored) : {}
}export function deleteReflections(date, userId = null) {
  const currentUserId = userId || getCurrentUserId()
  if (!currentUserId) return
  const reflectionsKey = getReflectionsKey(currentUserId)
  const stored = localStorage.getItem(reflectionsKey)
  const allReflections = stored ? JSON.parse(stored) : {}
  delete allReflections[date]
  localStorage.setItem(reflectionsKey, JSON.stringify(allReflections))
}

export function getAffirmation(userId = null) {
  const currentUserId = userId || getCurrentUserId()
  if (!currentUserId) return ''
  const affirmationKey = getAffirmationKey(currentUserId)
  const stored = localStorage.getItem(affirmationKey)
  return stored || ''
}

export function saveAffirmation(affirmation, userId = null) {
  const currentUserId = userId || getCurrentUserId()
  if (!currentUserId) return
  const affirmationKey = getAffirmationKey(currentUserId)
  localStorage.setItem(affirmationKey, affirmation)
}

// Initialize Yair's specific habits
export function initializeYairData(userId = 'yair') {
  if (!userId) return
  
  const metricsKey = getMetricsKey(userId)
  const entriesKey = getEntriesKey(userId)
  
  // Only initialize if data doesn't exist (first time setup)
  // NEVER clear existing data - this prevents data loss
  if (localStorage.getItem(metricsKey) && localStorage.getItem(entriesKey)) {
    return // Data already exists, don't overwrite
  }
  
  // Define Yair's habits
  const yairMetrics = [
    {
      id: '1',
      name: capitalizeHabitName('Wake up (Get out of bed 10sec of waking up)'),
      inputType: 'text',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '2',
      name: capitalizeHabitName('Making my bed'),
      inputType: 'binary',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '3',
      name: capitalizeHabitName('Morning Meditation / Affirmation'),
      inputType: 'binary',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '4',
      name: capitalizeHabitName('44 squats'),
      inputType: 'binary',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '5',
      name: capitalizeHabitName('44 push ups'),
      inputType: 'binary',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '6',
      name: capitalizeHabitName('Gym'),
      inputType: 'binary',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '7',
      name: capitalizeHabitName('Yoga'),
      inputType: 'binary',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '8',
      name: capitalizeHabitName('Work on business development (hours)'),
      inputType: 'binary',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '9',
      name: capitalizeHabitName('No Fap'),
      inputType: 'binary',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '10',
      name: capitalizeHabitName('No weed'),
      inputType: 'binary',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '11',
      name: capitalizeHabitName('No news'),
      inputType: 'binary',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '12',
      name: capitalizeHabitName('Eating clean'),
      inputType: 'binary',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '13',
      name: capitalizeHabitName('Not eating after 7pm'),
      inputType: 'binary',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '14',
      name: capitalizeHabitName('Filling out habit sheet'),
      inputType: 'binary',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '15',
      name: capitalizeHabitName('Journaling/gratitude before bed'),
      inputType: 'binary',
      question: '',
      active: true,
      frequency: 'daily',
    },
  ]
  
  // Save metrics
  saveMetrics(yairMetrics, userId)
  
  // Auto-fill weekends (Saturdays and Sundays) with gray dashes for current month
  const today = new Date()
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  
  const entries = {}
  
  daysInMonth.forEach(day => {
    const dayOfWeek = getDay(day) // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const dateStr = format(day, 'yyyy-MM-dd')
    
    if (isWeekend) {
      // Fill all weekend days with dashes for all metrics
      const dayEntries = {}
      yairMetrics.forEach(metric => {
        dayEntries[metric.id] = '-'
      })
      entries[dateStr] = dayEntries
    }
  })
  
  // Save entries
  if (Object.keys(entries).length > 0) {
    const entriesKey = getEntriesKey(userId)
    localStorage.setItem(entriesKey, JSON.stringify(entries))
  }
}

// Initialize Charter's specific habits
export function initializeCharterData(userId = 'charter') {
  if (!userId) return
  
  const metricsKey = getMetricsKey(userId)
  const entriesKey = getEntriesKey(userId)
  
  // Check if data exists
  const existingMetrics = localStorage.getItem(metricsKey)
  const existingEntries = localStorage.getItem(entriesKey)
  
  // If data exists, check if it's the default sample data
  if (existingMetrics) {
    const metrics = JSON.parse(existingMetrics)
    
    // Check if it's already Charter's data (has 'weed', 'mushies', etc.)
    const isCharterData = metrics.some(m => m.name === 'weed' || m.name === 'mushies' || m.name === 'alcohol')
    
    if (isCharterData) {
      // Already Charter's data, but update habit names to be capitalized
      const updatedMetrics = metrics.map(metric => ({
        ...metric,
        name: capitalizeHabitName(metric.name)
      }))
      saveMetrics(updatedMetrics, userId)
      
      // Make sure reflection config is set
      const configKey = getReflectionConfigKey(userId)
      const existingConfig = localStorage.getItem(configKey)
      if (!existingConfig) {
        const reflectionConfig = {
          fields: [
            { id: '1', label: 'PROUD', order: 0 },
            { id: '2', label: 'FORGIVE', order: 1 },
            { id: '3', label: 'GRATEFUL', order: 2 },
            { id: '4', label: 'EXERCISE', order: 3 },
            { id: '5', label: 'JOURNAL', order: 4 },
          ],
          showAffirmation: true
        }
        saveReflectionConfig(reflectionConfig, userId)
      } else {
        // Update existing config to ensure showAffirmation is true
        const config = JSON.parse(existingConfig)
        if (config.showAffirmation === false) {
          config.showAffirmation = true
          saveReflectionConfig(config, userId)
        }
      }
      return // Already Charter's data, don't overwrite
    }
    
    // Check if it's the sample data by looking for "Exercise" and "Water Intake" (sample metrics)
    const hasExercise = metrics.some(m => m.name === 'Exercise')
    const hasWaterIntake = metrics.some(m => m.name === 'Water Intake')
    const isSampleData = hasExercise && hasWaterIntake && metrics.length === 4
    
    // If it's sample data, we'll replace it below
    if (isSampleData) {
      // Clear the sample data to replace with Charter's data
      localStorage.removeItem(metricsKey)
      if (existingEntries) {
        localStorage.removeItem(entriesKey)
      }
    } else {
      // Unknown data exists, don't overwrite to prevent data loss
      return
    }
  }
  
  // Define Charter's habits
  const charterMetrics = [
    {
      id: '1',
      name: capitalizeHabitName('weed'),
      inputType: 'text',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '2',
      name: capitalizeHabitName('mushies'),
      inputType: 'numeric',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '3',
      name: capitalizeHabitName('alcohol'),
      inputType: 'numeric',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '4',
      name: capitalizeHabitName('other'),
      inputType: 'text',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '5',
      name: capitalizeHabitName('MR'),
      inputType: 'binary',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '6',
      name: capitalizeHabitName('Tgen'),
      inputType: 'text',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '7',
      name: capitalizeHabitName('sick'),
      inputType: 'binary',
      question: '',
      active: true,
      frequency: 'daily',
    },
    {
      id: '8',
      name: capitalizeHabitName('location'),
      inputType: 'text',
      question: '',
      active: true,
      frequency: 'daily',
    },
  ]
  
  // Save metrics
  saveMetrics(charterMetrics, userId)
  
  // Auto-fill weekends (Saturdays and Sundays) with gray dashes for current month
  const today = new Date()
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  
  const entries = {}
  
  daysInMonth.forEach(day => {
    const dayOfWeek = getDay(day) // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const dateStr = format(day, 'yyyy-MM-dd')
    
    if (isWeekend) {
      // Fill all weekend days with dashes for all metrics
      const dayEntries = {}
      charterMetrics.forEach(metric => {
        dayEntries[metric.id] = '-'
      })
      entries[dateStr] = dayEntries
    }
  })
  
  // Save entries
  if (Object.keys(entries).length > 0) {
    const entriesKey = getEntriesKey(userId)
    localStorage.setItem(entriesKey, JSON.stringify(entries))
  }
  
  // Initialize Charter's reflection configuration
  const reflectionConfig = {
    fields: [
      { id: '1', label: 'PROUD', order: 0 },
      { id: '2', label: 'FORGIVE', order: 1 },
      { id: '3', label: 'GRATEFUL', order: 2 },
      { id: '4', label: 'EXERCISE', order: 3 },
      { id: '5', label: 'JOURNAL', order: 4 },
    ],
    showAffirmation: true // Charter has affirmation field like Yair
  }
  
  // Only save reflection config if it doesn't exist
  const configKey = getReflectionConfigKey(userId)
  if (!localStorage.getItem(configKey)) {
    saveReflectionConfig(reflectionConfig, userId)
  }
}