import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getMetrics, saveEntry, getEntry, isMetricDue, getAllEntries, saveMetrics, getReflectionConfig, saveReflectionConfig, getReflections, saveReflections, getAllReflections, deleteReflections, getAffirmation, saveAffirmation, capitalizeHabitName } from '../utils/storage'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parseISO, addDays, subDays, isToday, isPast, startOfDay } from 'date-fns'
import { useUser } from '../contexts'
import { getUserViewPreference, setUserViewPreference } from '../utils/users'

export default function Capture() {
  const { currentUserId } = useUser()
  const [metrics, setMetrics] = useState([])
  const [entries, setEntries] = useState({})
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [viewMode, setViewMode] = useState('spreadsheet') // 'form' or 'spreadsheet'
  const [selectedCell, setSelectedCell] = useState(null) // { date, metricId }
  const [selectionRange, setSelectionRange] = useState(null) // { start: { date, metricId }, end: { date, metricId } }
  const [isSelecting, setIsSelecting] = useState(false) // Track if user is dragging to select cells
  const [copiedCells, setCopiedCells] = useState(null) // Store copied cell data for pasting
  const [editingCell, setEditingCell] = useState(null) // { date, metricId, metric }
  const [editValue, setEditValue] = useState('')
  const editInputRef = useRef(null)
  const [popupPosition, setPopupPosition] = useState(null) // { x, y, cellElement }
  const popupInputRef = useRef(null)
  const hasLoadedInitialView = useRef(false)
  const previousUserId = useRef(null)
  const [habitsColumnWidth, setHabitsColumnWidth] = useState('auto') // Dynamic width based on longest habit name
  const habitNameMeasureRef = useRef(null)
  
  // Undo/Redo history
  const historyRef = useRef([])
  const historyIndexRef = useRef(-1)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  
  // Drag and drop for reordering
  const [draggedMetricId, setDraggedMetricId] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [editingHabitName, setEditingHabitName] = useState(null) // { metricId, name }
  
  // Add habit modal
  const [showAddHabitModal, setShowAddHabitModal] = useState(false)
  const [newHabitForm, setNewHabitForm] = useState({
    name: '',
    question: '',
    inputType: 'binary',
    frequency: 'daily',
    active: true
  })
  
  // Reflection fields state
  const [reflectionConfig, setReflectionConfig] = useState(null)
  const [currentReflections, setCurrentReflections] = useState({})
  const [editingReflectionField, setEditingReflectionField] = useState(null) // { fieldId, value }
  const [editingAffirmation, setEditingAffirmation] = useState(false)
  const [affirmationValue, setAffirmationValue] = useState('')
  const [focusedReflectionFieldId, setFocusedReflectionFieldId] = useState(null)

  // Load user's preferred view mode when user changes
  useEffect(() => {
    if (!currentUserId) return
    
    // Check if user changed
    if (previousUserId.current !== currentUserId) {
      const preferredView = getUserViewPreference(currentUserId)
      setViewMode(preferredView)
      hasLoadedInitialView.current = true
      previousUserId.current = currentUserId
    }
  }, [currentUserId])

  // Save view preference when it changes (but not on initial load)
  useEffect(() => {
    if (!currentUserId || !hasLoadedInitialView.current) return
    setUserViewPreference(currentUserId, viewMode)
  }, [viewMode, currentUserId])

  useEffect(() => {
    if (!currentUserId) return
    let activeMetrics = getMetrics(currentUserId).filter((m) => m.active)
    
    // Capitalize all habit names (for existing habits that might not be capitalized)
    activeMetrics = activeMetrics.map(metric => ({
      ...metric,
      name: capitalizeHabitName(metric.name)
    }))
    
    // Save updated metrics if any names changed
    const allMetrics = getMetrics(currentUserId)
    const updatedAllMetrics = allMetrics.map(metric => ({
      ...metric,
      name: capitalizeHabitName(metric.name)
    }))
    
    // Check if any names changed
    const namesChanged = allMetrics.some((metric, idx) => 
      metric.name !== updatedAllMetrics[idx].name
    )
    
    if (namesChanged) {
      saveMetrics(updatedAllMetrics, currentUserId)
    }
    
    setMetrics(activeMetrics)
  }, [currentUserId])
  
  useEffect(() => {
    if (!currentUserId || metrics.length === 0) return
    loadEntries()
    // Initialize history with current entries state
    if (historyRef.current.length === 0) {
      const allEntries = getAllEntries(currentUserId)
      if (Object.keys(allEntries).length > 0) {
        historyRef.current = [JSON.parse(JSON.stringify(allEntries))]
        historyIndexRef.current = 0
        setCanUndo(false)
        setCanRedo(false)
      }
    }
  }, [date, viewMode, currentUserId, metrics])
  
  // Load reflection configuration and current reflections
  useEffect(() => {
    if (!currentUserId) return
    const config = getReflectionConfig(currentUserId)
    setReflectionConfig(config)
    
    // Delete reflections for Jan 5-8, 2026 (cleanup - only runs once per user)
    const cleanupKey = `reflections_cleanup_jan5_8_${currentUserId}`
    if (!localStorage.getItem(cleanupKey)) {
      const datesToDelete = [
        '2026-01-05',
        '2026-01-06',
        '2026-01-07',
        '2026-01-08'
      ]
      datesToDelete.forEach(dateStr => {
        deleteReflections(dateStr, currentUserId)
      })
      localStorage.setItem(cleanupKey, 'true')
    }
    
    // Load reflections for current date
    const reflections = getReflections(date, currentUserId)
    setCurrentReflections(reflections)
    
    // Load affirmation (persists across days, defaults to previous if empty)
    let affirmation = getAffirmation(currentUserId)
    // If no affirmation for current date, try to get from previous day
    if (!affirmation) {
      const previousDate = subDays(parseISO(date), 1)
      const previousDateStr = format(previousDate, 'yyyy-MM-dd')
      const previousReflections = getReflections(previousDateStr, currentUserId)
      // Check if previous day had an affirmation stored in reflections
      if (previousReflections.affirmation) {
        affirmation = previousReflections.affirmation
        // Save it as the current affirmation
        saveAffirmation(affirmation, currentUserId)
      }
    }
    setAffirmationValue(affirmation)
    
  }, [currentUserId, date])
  
  // Helper function to resize text to fit container
  const resizeTextToFit = (element, text, minFontSize = 6, startFontSize = null) => {
    if (!element || !text || element.offsetWidth === 0) return
    
    const containerWidth = element.offsetWidth
    const fontSize = startFontSize || parseFloat(window.getComputedStyle(element).fontSize) || 12
    
    // Create a temporary span to measure text width
    const measureEl = document.createElement('span')
    measureEl.style.visibility = 'hidden'
    measureEl.style.position = 'absolute'
    measureEl.style.whiteSpace = 'nowrap'
    measureEl.style.fontSize = `${fontSize}px`
    measureEl.style.fontWeight = window.getComputedStyle(element).fontWeight || 'normal'
    measureEl.textContent = text
    document.body.appendChild(measureEl)
    
    let currentFontSize = fontSize
    let textWidth = measureEl.offsetWidth
    
    // Shrink font until text fits or reaches minimum (6px)
    while (textWidth > containerWidth && currentFontSize > minFontSize) {
      currentFontSize -= 0.5
      measureEl.style.fontSize = `${currentFontSize}px`
      textWidth = measureEl.offsetWidth
    }
    
    document.body.removeChild(measureEl)
    element.style.fontSize = `${currentFontSize}px`
  }

  const stripLineNumbering = (value) => {
    if (!value) return ''
    return value
      .split('\n')
      .map((line) => line.replace(/^\s*\d+\.\s?/, ''))
      .join('\n')
  }

  const isCurrentLineEmpty = (value, cursorPos) => {
    const textBeforeCursor = value.slice(0, cursorPos)
    const lines = textBeforeCursor.split('\n')
    const currentLine = lines[lines.length - 1] || ''
    return currentLine.trim() === ''
  }

  const isBusinessDevHoursMetric = (metric) => {
    const name = (metric?.name || '').toLowerCase()
    const normalized = name.replace(/[^a-z0-9]+/g, ' ').trim()
    return (
      normalized.includes('business') &&
      normalized.includes('development') &&
      normalized.includes('hour')
    )
  }
  
  // Calculate habits column width based on longest habit name
  useEffect(() => {
    if (viewMode !== 'spreadsheet' || metrics.length === 0) {
      setHabitsColumnWidth('auto')
      return
    }
    
    const calculateHabitsWidth = () => {
      // Create a temporary element to measure text width
      const measureEl = document.createElement('span')
      measureEl.style.visibility = 'hidden'
      measureEl.style.position = 'absolute'
      measureEl.style.whiteSpace = 'nowrap'
      measureEl.style.fontSize = '0.75rem'
      measureEl.style.fontWeight = '600'
      measureEl.style.padding = '0 0.125rem' // px-0.5 = 0.125rem
      document.body.appendChild(measureEl)
      
      let maxWidth = 0
      metrics.forEach(metric => {
        if (metric.name) {
          measureEl.textContent = metric.name
          const textWidth = measureEl.offsetWidth
          if (textWidth > maxWidth) {
            maxWidth = textWidth
          }
        }
      })
      
      document.body.removeChild(measureEl)
      
      // Add padding for drag icon (h-3 w-3 = 12px) + gap (gap-0.5 = 2px) + cell padding
      const iconWidth = 12
      const gap = 2
      const cellPadding = 4 // px-0.5 = 2px on each side
      const totalWidth = maxWidth + iconWidth + gap + cellPadding + 20 // Add some extra buffer
      
      // Set minimum width and convert to pixels
      const minWidth = 100 // Minimum 100px
      const finalWidth = Math.max(totalWidth, minWidth)
      setHabitsColumnWidth(`${finalWidth}px`)
    }
    
    const handleResize = () => {
      setTimeout(() => {
        calculateHabitsWidth()
        
        // Recalculate font sizes for cell values
        const cellValues = document.querySelectorAll('[data-cell-value]')
        cellValues.forEach(el => {
          const text = el.textContent
          if (text) resizeTextToFit(el, text, 6, 12)
        })
      }, 100)
    }
    
    window.addEventListener('resize', handleResize)
    handleResize() // Initial calculation
    
    return () => window.removeEventListener('resize', handleResize)
  }, [viewMode, metrics, entries])
  
  // Auto-resize textareas when reflections or affirmation value changes or when switching users
  useEffect(() => {
    if (!reflectionConfig || viewMode !== 'spreadsheet') return
    
    // Auto-resize textareas to fit content after data loads
    const resizeTextareas = () => {
      // Resize reflection field textareas (always resize, even when empty)
      const reflectionTextareas = document.querySelectorAll('textarea[data-reflection-field="true"]')
      reflectionTextareas.forEach(textarea => {
        textarea.style.height = 'auto'
        if (textarea.value && textarea.value.trim() !== '') {
          textarea.style.height = Math.max(60, textarea.scrollHeight) + 'px'
        } else {
          // When empty, set to minimum height
          textarea.style.height = '60px'
        }
      })
      
      // Resize affirmation textarea if it exists and has content
      const affirmationTextarea = document.querySelector('textarea[data-affirmation="true"]')
      if (affirmationTextarea && affirmationTextarea.value && affirmationTextarea.value.trim() !== '') {
        affirmationTextarea.style.height = 'auto'
        affirmationTextarea.style.height = Math.max(30, affirmationTextarea.scrollHeight) + 'px'
      }
    }
    
    // Resize after a short delay to ensure DOM is updated
    const timeoutId = setTimeout(resizeTextareas, 200)
    
    return () => clearTimeout(timeoutId)
  }, [currentReflections, affirmationValue, reflectionConfig, viewMode, currentUserId])
  
  useEffect(() => {
    // Focus popup input when it appears
    if (popupPosition && popupInputRef.current) {
      popupInputRef.current.focus()
      popupInputRef.current.select()
    }
  }, [popupPosition])

  // Focus inline editing input when editing starts for text/time inputs
  useEffect(() => {
    if (editingCell && (editingCell.metric?.inputType === 'text' || editingCell.metric?.inputType === 'time') && editInputRef.current) {
      // Use setTimeout to ensure the input is rendered before focusing
      setTimeout(() => {
        if (editInputRef.current) {
          editInputRef.current.focus()
          editInputRef.current.select()
        }
      }, 0)
    }
  }, [editingCell])

  useEffect(() => {
    // Add keyboard listener for spreadsheet navigation
    if (viewMode === 'spreadsheet') {
      const handleKeyDown = (e) => {
        // Don't handle keys if user is typing in any input or textarea
        const activeElement = document.activeElement
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          // Check if it's not the inline editing input (that's handled separately)
          if (!(editingCell && (editingCell.metric?.inputType === 'text' || editingCell.metric?.inputType === 'time'))) {
            // User is typing in a form input or reflection textarea - let them type freely
            return
          }
        }
        
        // When editing inline (for text/time cells), let the input handle it
        if (editingCell && (editingCell.metric?.inputType === 'text' || editingCell.metric?.inputType === 'time')) {
          // The input's onKeyDown will handle Enter and Escape
          // Only handle Escape here if it's not already handled
          if (e.key === 'Escape') {
            handleCellCancel()
          }
          return
        }
        
        // When popup is open, only handle Escape
        if (popupPosition) {
          if (e.key === 'Escape') {
            handleCellCancel()
          }
          return
        }

        if (!selectedCell) return

        const { date: dateStr, metricId } = selectedCell
        const currentDate = parseISO(dateStr)
        const currentMetricIdx = metrics.findIndex(m => m.id === metricId)
        
        let newDate = currentDate
        let newMetricIdx = currentMetricIdx
        let shouldMove = false

        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault()
            newMetricIdx = Math.max(0, currentMetricIdx - 1)
            shouldMove = true
            break
          case 'ArrowDown':
            e.preventDefault()
            newMetricIdx = Math.min(metrics.length - 1, currentMetricIdx + 1)
            shouldMove = true
            break
          case 'ArrowLeft':
            e.preventDefault()
            newDate = subDays(currentDate, 1)
            shouldMove = true
            break
          case 'ArrowRight':
            e.preventDefault()
            newDate = addDays(currentDate, 1)
            shouldMove = true
            break
          case 'Tab':
            e.preventDefault()
            if (e.shiftKey) {
              newDate = subDays(currentDate, 1)
            } else {
              newDate = addDays(currentDate, 1)
            }
            shouldMove = true
            break
          case 'Enter':
            e.preventDefault()
            // Start editing current cell
            const metric = metrics[currentMetricIdx]
            if (metric) {
              handleCellDoubleClick(currentDate, metric)
            }
            break
          case 'F2':
            e.preventDefault()
            const metricF2 = metrics[currentMetricIdx]
            if (metricF2) {
              handleCellDoubleClick(currentDate, metricF2)
            }
            break
          case 'Backspace':
          case 'Delete':
            e.preventDefault()
            // Delete values in selected cells (range or single)
            const selectedCells = getSelectedCells()
            if (selectedCells.length > 0) {
              saveToHistory(entries)
              const newEntries = { ...entries }
              selectedCells.forEach(({ date: dateStr, metricId }) => {
                const dateEntries = newEntries[dateStr] || {}
                const { [metricId]: removed, ...rest } = dateEntries
                if (Object.keys(rest).length === 0) {
                  delete newEntries[dateStr]
                  const allEntries = getAllEntries(currentUserId)
                  delete allEntries[dateStr]
                  const entriesKey = `life_tracker_entries_${currentUserId}`
                  localStorage.setItem(entriesKey, JSON.stringify(allEntries))
                } else {
                  newEntries[dateStr] = rest
                  saveEntry(dateStr, rest, currentUserId)
                }
              })
              setEntries(newEntries)
            } else {
              // Fallback to single cell deletion
              const metricDelete = metrics[currentMetricIdx]
              if (metricDelete) {
                handleDirectInput(currentDate, metricDelete, '')
              }
            }
            break
          case 'c':
          case 'C':
            // Copy (Ctrl+C or Cmd+C)
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault()
              const selectedCellsToCopy = getSelectedCells()
              if (selectedCellsToCopy.length > 0) {
                // Get values from selected cells
                const copyData = selectedCellsToCopy.map(({ date: dateStr, metricId }) => {
                  const metric = metrics.find(m => m.id === metricId)
                  if (!metric) return null
                  const value = getEntryForDate(parseISO(dateStr), metricId)
                  return {
                    date: dateStr,
                    metricId,
                    value: value || '',
                    metricName: metric.name
                  }
                }).filter(Boolean)
                
                // Store copy data
                setCopiedCells(copyData)
                
                // Also copy to system clipboard as text
                try {
                  const clipboardText = copyData.map(d => d.value).join('	')
                  navigator.clipboard.writeText(clipboardText).catch(() => {})
                } catch (err) {
                  // Fallback if clipboard API fails
                }
              }
            }
            break
          case 'v':
          case 'V':
            // Paste (Ctrl+V or Cmd+V)
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault()
              if (!selectedCell) break
              
              // Try to read from clipboard first (for external pastes like Google Sheets)
              navigator.clipboard.readText().then(clipboardText => {
                if (clipboardText && clipboardText.trim()) {
                  // Parse clipboard data (handles both tab-separated and newline-separated values)
                  // For Google Sheets: values are typically tab-separated for rows, newline-separated for columns
                  // If it's a single column, values are newline-separated
                  const lines = clipboardText.split(/\r?\n/).filter(line => line.trim())
                  
                  if (lines.length > 0) {
                    // If first line has tabs, it's a multi-column paste (use first column)
                    // Otherwise, treat each line as a value
                    const values = lines.map(line => {
                      const parts = line.split('\t')
                      return parts[0].trim() // Use first column if tab-separated
                    })
                    
                    saveToHistory(entries)
                    const newEntries = { ...entries }
                    const pasteStartDate = parseISO(selectedCell.date)
                    const pasteStartMetricIdx = metrics.findIndex(m => m.id === selectedCell.metricId)
                    
                    if (pasteStartMetricIdx === -1) return
                    
                    // Paste values downward (same date column, different metrics/rows)
                    values.forEach((value, index) => {
                      const targetMetricIdx = pasteStartMetricIdx + index
                      if (targetMetricIdx < 0 || targetMetricIdx >= metrics.length) return
                      
                      const targetMetric = metrics[targetMetricIdx]
                      const targetDateStr = format(pasteStartDate, 'yyyy-MM-dd')
                      const dateEntries = newEntries[targetDateStr] || {}
                      const valueToSave = value.trim()
                      
                      // Convert binary values (1/0, yes/no) to proper format
                      let finalValue = valueToSave
                      if (targetMetric.inputType === 'binary') {
                        if (valueToSave.toLowerCase() === 'yes' || valueToSave === '1' || valueToSave.toLowerCase() === 'true') {
                          finalValue = 'yes'
                        } else if (valueToSave.toLowerCase() === 'no' || valueToSave === '0' || valueToSave.toLowerCase() === 'false' || valueToSave === '') {
                          finalValue = 'no'
                        } else {
                          finalValue = valueToSave // Keep as-is if not standard binary
                        }
                      }
                      
                      if (finalValue === '' || finalValue === null) {
                        // Remove entry if empty
                        const { [targetMetric.id]: removed, ...rest } = dateEntries
                        if (Object.keys(rest).length === 0) {
                          delete newEntries[targetDateStr]
                        } else {
                          newEntries[targetDateStr] = rest
                        }
                        saveEntry(targetDateStr, rest, currentUserId)
                      } else {
                        newEntries[targetDateStr] = {
                          ...dateEntries,
                          [targetMetric.id]: finalValue
                        }
                        saveEntry(targetDateStr, {
                          ...dateEntries,
                          [targetMetric.id]: finalValue
                        }, currentUserId)
                      }
                    })
                    
                    setEntries(newEntries)
                    return
                  }
                }
                
                // Fallback to internal copy/paste if clipboard is empty or fails
                if (copiedCells && copiedCells.length > 0) {
                  saveToHistory(entries)
                  const newEntries = { ...entries }
                  const pasteStartDate = parseISO(selectedCell.date)
                  const pasteStartMetricIdx = metrics.findIndex(m => m.id === selectedCell.metricId)
                  
                  if (pasteStartMetricIdx === -1) return
                  
                  // Get first copied cell's metric index for relative positioning
                  const firstCopiedMetricIdx = metrics.findIndex(m => m.id === copiedCells[0].metricId)
                  
                  // Paste copied cells starting from selected cell
                  copiedCells.forEach((copyItem, index) => {
                    // Calculate target date (relative to paste start)
                    const sourceDate = parseISO(copyItem.date)
                    const firstCopiedDate = parseISO(copiedCells[0].date)
                    const dateOffset = Math.floor((sourceDate - firstCopiedDate) / (1000 * 60 * 60 * 24))
                    const targetDate = addDays(pasteStartDate, dateOffset + index)
                    const targetDateStr = format(targetDate, 'yyyy-MM-dd')
                    
                    // Only paste if date is in current month
                    if (!allDays.find(d => format(d, 'yyyy-MM-dd') === targetDateStr)) return
                    
                    // Calculate target metric index (relative to paste start)
                    const sourceMetricIdx = firstCopiedMetricIdx >= 0 ? firstCopiedMetricIdx : pasteStartMetricIdx
                    const metricOffset = index
                    const targetMetricIdx = pasteStartMetricIdx + metricOffset
                    
                    if (targetMetricIdx < 0 || targetMetricIdx >= metrics.length) return
                    
                    const targetMetric = metrics[targetMetricIdx]
                    const dateEntries = newEntries[targetDateStr] || {}
                    const valueToSave = copyItem.value
                    
                    if (valueToSave === '' || valueToSave === null) {
                      // Remove entry if empty
                      const { [targetMetric.id]: removed, ...rest } = dateEntries
                      if (Object.keys(rest).length === 0) {
                        delete newEntries[targetDateStr]
                      } else {
                        newEntries[targetDateStr] = rest
                      }
                    } else {
                      newEntries[targetDateStr] = {
                        ...dateEntries,
                        [targetMetric.id]: valueToSave
                      }
                      saveEntry(targetDateStr, {
                        ...dateEntries,
                        [targetMetric.id]: valueToSave
                      }, currentUserId)
                    }
                  })
                  
                  setEntries(newEntries)
                }
              }).catch(err => {
                // If clipboard read fails, try internal copy/paste
                if (copiedCells && copiedCells.length > 0 && selectedCell) {
                  saveToHistory(entries)
                  const newEntries = { ...entries }
                  const pasteStartDate = parseISO(selectedCell.date)
                  const pasteStartMetricIdx = metrics.findIndex(m => m.id === selectedCell.metricId)
                  
                  if (pasteStartMetricIdx === -1) return
                  
                  // Get first copied cell's metric index for relative positioning
                  const firstCopiedMetricIdx = metrics.findIndex(m => m.id === copiedCells[0].metricId)
                  
                  // Paste copied cells starting from selected cell
                  copiedCells.forEach((copyItem, index) => {
                    // Calculate target date (relative to paste start)
                    const sourceDate = parseISO(copyItem.date)
                    const firstCopiedDate = parseISO(copiedCells[0].date)
                    const dateOffset = Math.floor((sourceDate - firstCopiedDate) / (1000 * 60 * 60 * 24))
                    const targetDate = addDays(pasteStartDate, dateOffset + index)
                    const targetDateStr = format(targetDate, 'yyyy-MM-dd')
                    
                    // Only paste if date is in current month
                    if (!allDays.find(d => format(d, 'yyyy-MM-dd') === targetDateStr)) return
                    
                    // Calculate target metric index (relative to paste start)
                    const sourceMetricIdx = firstCopiedMetricIdx >= 0 ? firstCopiedMetricIdx : pasteStartMetricIdx
                    const metricOffset = index
                    const targetMetricIdx = pasteStartMetricIdx + metricOffset
                    
                    if (targetMetricIdx < 0 || targetMetricIdx >= metrics.length) return
                    
                    const targetMetric = metrics[targetMetricIdx]
                    const dateEntries = newEntries[targetDateStr] || {}
                    const valueToSave = copyItem.value
                    
                    if (valueToSave === '' || valueToSave === null) {
                      // Remove entry if empty
                      const { [targetMetric.id]: removed, ...rest } = dateEntries
                      if (Object.keys(rest).length === 0) {
                        delete newEntries[targetDateStr]
                      } else {
                        newEntries[targetDateStr] = rest
                      }
                    } else {
                      newEntries[targetDateStr] = {
                        ...dateEntries,
                        [targetMetric.id]: valueToSave
                      }
                      saveEntry(targetDateStr, {
                        ...dateEntries,
                        [targetMetric.id]: valueToSave
                      }, currentUserId)
                    }
                  })
                  
                  setEntries(newEntries)
                }
              })
            }
            break
          default:
            // If typing a printable character
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              const metricTyping = metrics[currentMetricIdx]
              if (metricTyping) {
                // For text/time cells, start inline editing
                if (metricTyping.inputType === 'text' || metricTyping.inputType === 'time') {
                  e.preventDefault()
                  e.stopPropagation()
                  // Start editing with the typed character
                  const currentValue = entries[dateStr]?.[metricTyping.id] || ''
                  const initialValue = currentValue ? currentValue.toString() + e.key : e.key
                  setSelectedCell({ date: dateStr, metricId: metricTyping.id })
                  setEditingCell({ date: dateStr, metricId: metricTyping.id, metric: metricTyping })
                  setEditValue(initialValue)
                } else {
                  // For binary/numeric cells, use direct input
                  e.preventDefault()
                  handleDirectInput(currentDate, metricTyping, e.key)
                  // Move to next row (down) after input
                  const newMetricIdx = Math.min(metrics.length - 1, currentMetricIdx + 1)
                  const newMetric = metrics[newMetricIdx]
                  if (newMetric) {
                    setSelectedCell({ date: dateStr, metricId: newMetric.id })
                  }
                }
              }
            } else if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
              // Ctrl+Z or Cmd+Z: Undo
              e.preventDefault()
              handleUndo()
            } else if (e.key === 'y' && (e.metaKey || e.ctrlKey)) {
              // Ctrl+Y or Cmd+Y: Redo
              e.preventDefault()
              handleRedo()
            } else if (e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
              // Ctrl+Shift+Z or Cmd+Shift+Z: Redo (alternative)
              e.preventDefault()
              handleRedo()
            }
        }

        if (shouldMove) {
          const newMetric = metrics[newMetricIdx]
          if (newMetric) {
            const newDateStr = format(newDate, 'yyyy-MM-dd')
            setSelectedCell({ date: newDateStr, metricId: newMetric.id })
          }
        }
      }

      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [viewMode, selectedCell, editingCell, metrics, entries])

  const loadEntries = () => {
    if (!currentUserId) return
    if (viewMode === 'form') {
      const existingEntry = getEntry(date, currentUserId)
      setEntries(existingEntry || {})
    } else {
      // Load all entries for spreadsheet view
      const allEntries = getAllEntries(currentUserId)
      
      // Auto-fill weekends (Saturdays and Sundays) with gray dashes
      const monthStart = startOfMonth(parseISO(date + 'T00:00:00'))
      const monthEnd = endOfMonth(parseISO(date + 'T00:00:00'))
      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
      
      const updatedEntries = { ...allEntries }
      let hasWeekendChanges = false
      
      daysInMonth.forEach(day => {
        const dayOfWeek = getDay(day) // 0 = Sunday, 6 = Saturday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        const dateStr = format(day, 'yyyy-MM-dd')
        
        if (isWeekend) {
          // For each metric, ensure weekend days have a dash
          metrics.forEach(metric => {
            const dateEntries = updatedEntries[dateStr] || {}
            // Only set dash if the cell is empty (don't overwrite existing values)
            if (!dateEntries[metric.id] || dateEntries[metric.id] === '') {
              updatedEntries[dateStr] = {
                ...dateEntries,
                [metric.id]: '-'
              }
              saveEntry(dateStr, {
                ...dateEntries,
                [metric.id]: '-'
              }, currentUserId)
              hasWeekendChanges = true
            }
          })
        }
      })
      
      const finalEntries = hasWeekendChanges ? updatedEntries : allEntries
      setEntries(finalEntries)
      // Initialize history with the loaded state
      historyRef.current = [JSON.parse(JSON.stringify(finalEntries))]
      historyIndexRef.current = 0
    }
  }

  const handleInputChange = (metricId, value) => {
    setEntries({
      ...entries,
      [metricId]: value,
    })
  }

  const handleAddHabit = () => {
    if (!newHabitForm.name.trim()) return
    
    // Get all metrics (including inactive ones)
    const allMetrics = getMetrics(currentUserId)
    
    // Create new habit (automatically capitalize the name)
    const newMetric = {
      id: Date.now().toString(),
      name: capitalizeHabitName(newHabitForm.name.trim()),
      question: newHabitForm.question.trim() || capitalizeHabitName(newHabitForm.name.trim()),
      inputType: newHabitForm.inputType,
      frequency: newHabitForm.frequency,
      active: true
    }
    
    // Add to metrics list
    const updatedMetrics = [...allMetrics, newMetric]
    saveMetrics(updatedMetrics, currentUserId)
    
    // Refresh metrics list (only active ones are shown)
    const activeMetrics = updatedMetrics.filter((m) => m.active)
    setMetrics(activeMetrics)
    
    // Auto-fill weekends (Saturdays and Sundays) with gray dashes for the new habit
    const monthStart = startOfMonth(parseISO(date + 'T00:00:00'))
    const monthEnd = endOfMonth(parseISO(date + 'T00:00:00'))
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
    
    saveToHistory(entries)
    const updatedEntries = { ...entries }
    
    daysInMonth.forEach(day => {
      const dayOfWeek = getDay(day) // 0 = Sunday, 6 = Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const dateStr = format(day, 'yyyy-MM-dd')
      
      if (isWeekend) {
        const dateEntries = updatedEntries[dateStr] || {}
        updatedEntries[dateStr] = {
          ...dateEntries,
          [newMetric.id]: '-'
        }
        saveEntry(dateStr, {
          ...dateEntries,
          [newMetric.id]: '-'
        }, currentUserId)
      }
    })
    
    setEntries(updatedEntries)
    
    // Reset form and close modal
    setNewHabitForm({
      name: '',
      question: '',
      inputType: 'binary',
      frequency: 'daily',
      active: true
    })
    setShowAddHabitModal(false)
  }
  
  // Handle drag and drop for reordering habits
  const handleDragStart = (e, metricId) => {
    // Prevent drag if editing habit name
    if (editingHabitName && editingHabitName.metricId === metricId) {
      e.preventDefault()
      return
    }
    setDraggedMetricId(metricId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', e.target.outerHTML)
    // Set opacity on the entire row, not just the target
    const row = e.target.closest('tr')
    if (row) {
      row.style.opacity = '0.5'
    }
  }
  
  const handleDragEnd = (e) => {
    // Reset opacity on the entire row
    const row = e.target.closest('tr')
    if (row) {
      row.style.opacity = ''
    }
    setDraggedMetricId(null)
    setDragOverIndex(null)
  }
  
  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }
  
  const handleDragLeave = () => {
    setDragOverIndex(null)
  }
  
  const handleDrop = (e, dropIndex) => {
    e.preventDefault()
    
    if (draggedMetricId === null || dragOverIndex === null) {
      setDraggedMetricId(null)
      setDragOverIndex(null)
      return
    }
    
    const draggedIndex = metrics.findIndex(m => m.id === draggedMetricId)
    if (draggedIndex === -1 || draggedIndex === dropIndex) {
      setDraggedMetricId(null)
      setDragOverIndex(null)
      return
    }
    
    // Reorder metrics
    const newMetrics = [...metrics]
    const [draggedMetric] = newMetrics.splice(draggedIndex, 1)
    newMetrics.splice(dropIndex, 0, draggedMetric)
    
    // Get all metrics (including inactive) and update order
    const allMetrics = getMetrics(currentUserId)
    const metricMap = new Map(allMetrics.map(m => [m.id, m]))
    
    // Update the order while preserving inactive metrics
    const reorderedAllMetrics = newMetrics.map(m => metricMap.get(m.id) || m)
    
    // Add any inactive metrics that weren't in the active list
    allMetrics.forEach(m => {
      if (!m.active && !reorderedAllMetrics.find(rm => rm.id === m.id)) {
        reorderedAllMetrics.push(m)
      }
    })
    
    setMetrics(newMetrics)
    saveMetrics(reorderedAllMetrics, currentUserId)
    
    setDraggedMetricId(null)
    setDragOverIndex(null)
  }

  const handleHabitNameDoubleClick = (metric) => {
    setEditingHabitName({ metricId: metric.id, name: metric.name })
  }

  const handleHabitNameSave = (metricId, newName) => {
    if (!currentUserId || !newName || newName.trim() === '') {
      setEditingHabitName(null)
      return
    }
    
    const capitalizedName = capitalizeHabitName(newName.trim())
    const allMetrics = getMetrics(currentUserId)
    const updatedMetrics = allMetrics.map(m => 
      m.id === metricId ? { ...m, name: capitalizedName } : m
    )
    saveMetrics(updatedMetrics, currentUserId)
    
    // Update local state
    const activeMetrics = updatedMetrics.filter(m => m.active)
    setMetrics(activeMetrics)
    setEditingHabitName(null)
  }

  const handleSave = () => {
    if (!currentUserId) return
    if (viewMode === 'form') {
      // Filter out dashes when saving from form view - if user entered a value, save it
      // Dashes should only exist in spreadsheet view (for weekends, etc.)
      const entriesToSave = { ...entries }
      Object.keys(entriesToSave).forEach(metricId => {
        // If the value is a dash, remove it (treat as empty)
        // But preserve actual empty strings and other values
        if (entriesToSave[metricId] === '-') {
          delete entriesToSave[metricId]
        }
      })
      saveEntry(date, entriesToSave, currentUserId)
      // Reload entries to sync with localStorage
      loadEntries()
      alert('Entry saved successfully!')
    } else {
      // Save all entries (they're saved on individual cell changes)
      alert('All changes saved!')
    }
  }

  const handleCellClick = (day, metric, e) => {
    if (!day) return
    const dateStr = format(day, 'yyyy-MM-dd')

    // If already editing this cell, don't change selection
    if (editingCell && editingCell.date === dateStr && editingCell.metricId === metric.id) {
      return
    }

    // Save any current edit first
    if (editingCell) {
      handleCellSave()
    }

    // Handle Shift+Click for range selection
    if (e && e.shiftKey && selectedCell) {
      // Create selection range from selectedCell to clicked cell
      setSelectionRange({
        start: selectedCell,
        end: { date: dateStr, metricId: metric.id }
      })
      setSelectedCell({ date: dateStr, metricId: metric.id })
    } else {
      // Regular click - select single cell and clear range
      setSelectedCell({ date: dateStr, metricId: metric.id })
      setSelectionRange(null)
    }
    setEditingCell(null)
  }

  // Handle mouse down on cell to start selection drag
  const handleCellMouseDown = (day, metric, e) => {
    if (!day) return
    // Only start selection if clicking on the cell itself, not on child elements like the fill handle
    if (e.target.closest('.cell-selected-fill-handle')) {
      return // Let fill handle handle its own drag
    }
    
    const dateStr = format(day, 'yyyy-MM-dd')
    
    // Save any current edit first
    if (editingCell) {
      handleCellSave()
    }
    
    // Start selection from this cell
    const startCell = { date: dateStr, metricId: metric.id }
    setSelectedCell(startCell)
    setSelectionRange(null)
    setIsSelecting(true)
    
    const handleMouseMove = (moveEvent) => {
      if (!isSelecting) return
      
      const targetElement = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)
      if (!targetElement) return
      
      // Find the closest td element
      const targetCell = targetElement.closest('td[data-date]')
      if (!targetCell) return
      
      const cellDateStr = targetCell.getAttribute('data-date')
      const cellMetricId = targetCell.getAttribute('data-metric-id')
      
      if (!cellDateStr || !cellMetricId) return
      
      // Update selection range
      setSelectionRange({
        start: startCell,
        end: { date: cellDateStr, metricId: cellMetricId }
      })
      setSelectedCell({ date: cellDateStr, metricId: cellMetricId })
    }
    
    const handleMouseUp = () => {
      setIsSelecting(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp, { once: true })
  }

  const handleCellDoubleClick = (day, metric, cellElement, initialValue = null) => {
    if (!day) return
    const dateStr = format(day, 'yyyy-MM-dd')

    const currentValue = entries[dateStr]?.[metric.id] || ''
    
    // Convert value for editing
    let displayValue = initialValue !== null ? initialValue : currentValue
    if (metric.inputType === 'binary' && initialValue === null) {
      displayValue = currentValue === 'yes' ? '1' : currentValue === 'no' ? '0' : ''
    } else if (initialValue === null) {
      displayValue = currentValue.toString()
    }
    
    setSelectedCell({ date: dateStr, metricId: metric.id })
    setEditingCell({ date: dateStr, metricId: metric.id, metric })
    setEditValue(displayValue)
    
    // Calculate popup position - top-left corner of popup touches top-right corner of cell
    if (cellElement) {
      // Use getBoundingClientRect which returns viewport coordinates (perfect for fixed positioning)
      const rect = cellElement.getBoundingClientRect()
      const cellWidth = rect.width
      const cellHeight = rect.height
      
      // Position popup so its top-left corner aligns with cell's top-right corner
      // rect.right and rect.top are already viewport coordinates for fixed positioning
      const x = rect.right
      const y = rect.top
      
      // Debug logging
      console.log('Cell rect:', { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height })
      console.log('Popup position:', { x, y, cellWidth, cellHeight })
      console.log('Window scroll:', { scrollX: window.scrollX, scrollY: window.scrollY })
      
      setPopupPosition({
        x, // Right edge of cell = left edge of popup
        y,  // Top edge of cell = top edge of popup
        cellWidth,
        cellHeight
      })
    }
  }

  const handleDirectInput = (day, metric, inputValue) => {
    if (!day) return
    const dateStr = format(day, 'yyyy-MM-dd')
    
    // Save to history before making changes
    saveToHistory(entries)
    
    let valueToSave = inputValue.trim()
    
    // Handle dash input
    if (valueToSave === '-') {
      valueToSave = '-'
    } else {
      // Convert input based on metric type
      if (metric.inputType === 'binary') {
        valueToSave = valueToSave === '1' ? 'yes' : valueToSave === '0' ? 'no' : ''
      } else if (metric.inputType === 'numeric') {
        valueToSave = valueToSave === '' ? '' : parseFloat(valueToSave) || valueToSave
      }
    }
    
    // Update entries
    const dateEntries = entries[dateStr] || {}
    if (valueToSave === '' || valueToSave === null) {
      // Remove entry if empty
      const { [metric.id]: removed, ...rest } = dateEntries
      if (Object.keys(rest).length === 0) {
        const { [dateStr]: removedDate, ...restEntries } = entries
        setEntries(restEntries)
        const allEntries = getAllEntries(currentUserId)
        delete allEntries[dateStr]
        const entriesKey = `life_tracker_entries_${currentUserId}`
        localStorage.setItem(entriesKey, JSON.stringify(allEntries))
      } else {
        setEntries({ ...entries, [dateStr]: rest })
        saveEntry(dateStr, rest, currentUserId)
      }
    } else {
      setEntries({
        ...entries,
        [dateStr]: {
          ...dateEntries,
          [metric.id]: valueToSave,
        },
      })
      saveEntry(dateStr, {
        ...dateEntries,
        [metric.id]: valueToSave,
      }, currentUserId)
    }
  }

  const handleCellSave = () => {
    if (!editingCell) return
    
    const { date: dateStr, metricId, metric } = editingCell
    // For text/time inputs, preserve the value as-is (don't trim)
    // For binary/numeric, trim whitespace
    let valueToSave = (metric.inputType === 'text' || metric.inputType === 'time') 
      ? editValue 
      : editValue.trim()
    
    // Handle dash input
    if (valueToSave === '-') {
      valueToSave = '-'
    } else {
    // Convert input based on metric type
    if (metric.inputType === 'binary') {
      valueToSave = valueToSave === '1' ? 'yes' : valueToSave === '0' ? 'no' : ''
    } else if (metric.inputType === 'numeric') {
      valueToSave = valueToSave === '' ? '' : parseFloat(valueToSave) || valueToSave
      }
      // For text/time inputs, keep the value as-is
    }
    
    // Update entries
    const dateEntries = entries[dateStr] || {}
    if (valueToSave === '' || valueToSave === null) {
      // Remove entry if empty
      const { [metricId]: removed, ...rest } = dateEntries
      if (Object.keys(rest).length === 0) {
        const { [dateStr]: removedDate, ...restEntries } = entries
        setEntries(restEntries)
        // Also remove from localStorage
        const allEntries = getAllEntries(currentUserId)
        delete allEntries[dateStr]
        const entriesKey = `life_tracker_entries_${currentUserId}`
        localStorage.setItem(entriesKey, JSON.stringify(allEntries))
      } else {
        setEntries({ ...entries, [dateStr]: rest })
        saveEntry(dateStr, rest, currentUserId)
      }
    } else {
      setEntries({
        ...entries,
        [dateStr]: {
          ...dateEntries,
          [metricId]: valueToSave,
        },
      })
      saveEntry(dateStr, {
        ...dateEntries,
        [metricId]: valueToSave,
      }, currentUserId)
    }
    
    setEditingCell(null)
    setEditValue('')
    setPopupPosition(null)
  }

  const handleCellCancel = () => {
    setEditingCell(null)
    setEditValue('')
    setPopupPosition(null)
    // Keep selection
  }
  
  const handlePopupSave = (moveToNext = true) => {
    if (!editingCell) return
    
    const { date: dateStr, metricId, metric } = editingCell
    // For text/time inputs, preserve the value as-is (don't trim)
    // For binary/numeric, trim whitespace
    let valueToSave = (metric.inputType === 'text' || metric.inputType === 'time') 
      ? editValue 
      : editValue.trim()
    
    // Handle dash input
    if (valueToSave === '-') {
      valueToSave = '-'
    } else {
      // Convert input based on metric type
      if (metric.inputType === 'binary') {
        valueToSave = valueToSave === '1' ? 'yes' : valueToSave === '0' ? 'no' : ''
      } else if (metric.inputType === 'numeric') {
        valueToSave = valueToSave === '' ? '' : parseFloat(valueToSave) || valueToSave
      }
      // For text/time inputs, keep the value as-is
    }
    
    // Save to history before making changes
    saveToHistory(entries)
    
    // Update entries
    const dateEntries = entries[dateStr] || {}
    if (valueToSave === '' || valueToSave === null) {
      // Remove entry if empty
      const { [metricId]: removed, ...rest } = dateEntries
      if (Object.keys(rest).length === 0) {
        const { [dateStr]: removedDate, ...restEntries } = entries
        setEntries(restEntries)
        const allEntries = getAllEntries(currentUserId)
        delete allEntries[dateStr]
        const entriesKey = `life_tracker_entries_${currentUserId}`
        localStorage.setItem(entriesKey, JSON.stringify(allEntries))
      } else {
        setEntries({ ...entries, [dateStr]: rest })
        saveEntry(dateStr, rest, currentUserId)
      }
    } else {
      setEntries({
        ...entries,
        [dateStr]: {
          ...dateEntries,
          [metricId]: valueToSave,
        },
      })
      saveEntry(dateStr, {
        ...dateEntries,
        [metricId]: valueToSave,
      }, currentUserId)
    }
    
    setEditingCell(null)
    setEditValue('')
    setPopupPosition(null)
    
    // Move to next cell (down - next habit) after saving, if requested
    if (moveToNext) {
      const currentMetricIdx = metrics.findIndex(m => m.id === metricId)
      const nextMetricIdx = Math.min(metrics.length - 1, currentMetricIdx + 1)
      const nextMetric = metrics[nextMetricIdx]
      if (nextMetric) {
        setSelectedCell({ date: dateStr, metricId: nextMetric.id })
      }
    }
  }
  
  const handlePopupKeyDown = (e) => {
    // Prevent any navigation keys from bubbling up when popup is open
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      handlePopupSave(true) // Move to next cell after saving
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      handleCellCancel()
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
      // Allow arrow keys and tab within the textarea for text editing
      // Don't prevent default - let the textarea handle them
      e.stopPropagation() // But stop propagation to prevent navigation
    }
    // All other keys (letters, numbers, etc.) should work normally in the textarea
  }

  // Save current state to history before making changes
  const saveToHistory = (currentEntries) => {
    // Remove any history after current index (when undoing and then making new changes)
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    }
    
    // Create a deep copy of entries
    const entriesCopy = JSON.parse(JSON.stringify(currentEntries))
    
    // Add to history
    historyRef.current.push(entriesCopy)
    historyIndexRef.current = historyRef.current.length - 1
    
    // Limit history size to prevent memory issues (keep last 1000 states)
    if (historyRef.current.length > 1000) {
      historyRef.current.shift()
      historyIndexRef.current = historyRef.current.length - 1
    }
    
    // Update button states
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
  }

  // Undo last change
  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--
      const previousEntries = historyRef.current[historyIndexRef.current]
      const restoredEntries = JSON.parse(JSON.stringify(previousEntries))
      
      // Update state
      setEntries(restoredEntries)
      
      // Also update localStorage with the undone state - save each entry individually
      const entriesKey = `life_tracker_entries_${currentUserId}`
      localStorage.setItem(entriesKey, JSON.stringify(restoredEntries))
      
      // Also save each entry individually using saveEntry to ensure consistency
      Object.keys(restoredEntries).forEach(dateStr => {
        saveEntry(dateStr, restoredEntries[dateStr], currentUserId)
      })
      
      // Update button states
      setCanUndo(historyIndexRef.current > 0)
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
    }
  }

  // Redo last undone change
  const handleRedo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++
      const nextEntries = historyRef.current[historyIndexRef.current]
      const restoredEntries = JSON.parse(JSON.stringify(nextEntries))
      
      // Update state
      setEntries(restoredEntries)
      
      // Also update localStorage with the redone state - save each entry individually
      const entriesKey = `life_tracker_entries_${currentUserId}`
      localStorage.setItem(entriesKey, JSON.stringify(restoredEntries))
      
      // Also save each entry individually using saveEntry to ensure consistency
      Object.keys(restoredEntries).forEach(dateStr => {
        saveEntry(dateStr, restoredEntries[dateStr], currentUserId)
      })
      
      // Update button states
      setCanUndo(historyIndexRef.current > 0)
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
    }
  }

  const handleFillHandleDragStart = (e, startDay, metric) => {
    e.preventDefault()
    e.stopPropagation()
    
    const startDateStr = format(startDay, 'yyyy-MM-dd')
    const startValue = getEntryForDate(startDay, metric.id)
    
    if (!startValue && startValue !== 0 && startValue !== '0') return // Don't copy empty cells
    
    // Save to history before starting drag operation
    saveToHistory(entries)
    
    let isDragging = true
    const startDateIdx = allDays.findIndex(day => format(day, 'yyyy-MM-dd') === startDateStr)
    const startMetricIdx = metrics.findIndex(m => m.id === metric.id)
    let lastEndDateIdx = startDateIdx
    let lastEndMetricIdx = startMetricIdx
    
    const handleMouseMove = (moveEvent) => {
      if (!isDragging) return
      
      const targetElement = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)
      if (!targetElement) return
      
      // Find the closest td element
      const targetCell = targetElement.closest('td[data-date]')
      if (!targetCell) return
      
      const cellDateStr = targetCell.getAttribute('data-date')
      const cellMetricId = targetCell.getAttribute('data-metric-id')
      
      // Find the index of the target date and metric
      const targetDateIdx = allDays.findIndex(day => format(day, 'yyyy-MM-dd') === cellDateStr)
      const targetMetricIdx = metrics.findIndex(m => m.id === cellMetricId)
      
      if (targetDateIdx === -1 || targetMetricIdx === -1) return
      
      // Update all cells in the range from start to current target
      if (targetDateIdx !== lastEndDateIdx || targetMetricIdx !== lastEndMetricIdx) {
        // Determine direction and range for dates
        const minDateIdx = Math.min(startDateIdx, targetDateIdx)
        const maxDateIdx = Math.max(startDateIdx, targetDateIdx)
        
        // Determine direction and range for metrics
        const minMetricIdx = Math.min(startMetricIdx, targetMetricIdx)
        const maxMetricIdx = Math.max(startMetricIdx, targetMetricIdx)
        
        // Use functional state update to ensure we're working with the latest state
        setEntries(prevEntries => {
          const newEntries = { ...prevEntries }
          let hasChanges = false
          
          // Fill all cells in the range (excluding the source cell)
          for (let metricIdx = minMetricIdx; metricIdx <= maxMetricIdx; metricIdx++) {
            const targetMetric = metrics[metricIdx]
            if (!targetMetric) continue
            
            for (let dateIdx = minDateIdx; dateIdx <= maxDateIdx; dateIdx++) {
              // Skip the source cell
              if (dateIdx === startDateIdx && metricIdx === startMetricIdx) continue
              
              const targetDay = allDays[dateIdx]
              if (!targetDay) continue
              
              const targetDateStr = format(targetDay, 'yyyy-MM-dd')
              const dateEntries = newEntries[targetDateStr] || {}
              
              newEntries[targetDateStr] = {
                ...dateEntries,
                [targetMetric.id]: startValue
              }
              
              saveEntry(targetDateStr, {
                ...dateEntries,
                [targetMetric.id]: startValue
              }, currentUserId)
              
              hasChanges = true
            }
          }
          
          return hasChanges ? newEntries : prevEntries
        })
        
        lastEndDateIdx = targetDateIdx
        lastEndMetricIdx = targetMetricIdx
      }
    }
    
    const handleMouseUp = () => {
      isDragging = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp, { once: true })
  }

  const handleEditInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCellSave()
      // Move to next row (down)
      if (selectedCell) {
        const currentDate = parseISO(selectedCell.date)
        const currentMetricIdx = metrics.findIndex(m => m.id === selectedCell.metricId)
        const newMetricIdx = Math.min(metrics.length - 1, currentMetricIdx + 1)
        const newMetric = metrics[newMetricIdx]
        if (newMetric) {
          setSelectedCell({ date: selectedCell.date, metricId: newMetric.id })
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      handleCellSave()
      // Move to next column
      if (selectedCell) {
        const currentDate = parseISO(selectedCell.date)
        const newDate = e.shiftKey ? subDays(currentDate, 1) : addDays(currentDate, 1)
        const newDateStr = format(newDate, 'yyyy-MM-dd')
        setSelectedCell({ date: newDateStr, metricId: selectedCell.metricId })
      }
    } else         if (e.key === 'Escape') {
      e.preventDefault()
      handleCellCancel()
    } else if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
      // Ctrl+Z or Cmd+Z: Undo
      e.preventDefault()
      handleUndo()
    } else if (e.key === 'y' && (e.metaKey || e.ctrlKey)) {
      // Ctrl+Y or Cmd+Y: Redo
      e.preventDefault()
      handleRedo()
    } else if (e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
      // Ctrl+Shift+Z or Cmd+Shift+Z: Redo (alternative)
      e.preventDefault()
      handleRedo()
    }
  }

  const dueMetrics = metrics.filter((m) => isMetricDue(m, date))

  // Spreadsheet view calculations
  const selectedDateObj = parseISO(date + 'T00:00:00')
  const monthStart = startOfMonth(selectedDateObj)
  const monthEnd = endOfMonth(selectedDateObj)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const allDays = daysInMonth

  const getEntryForDate = (date, metricId) => {
    if (!date) return null
    const dateStr = format(date, 'yyyy-MM-dd')
    const entry = entries[dateStr]?.[metricId]
    
    // Special handling for "location" habit: carry forward from previous day if empty
    if (currentUserId === 'charter') {
      const metric = metrics.find(m => m.id === metricId)
      if (metric && metric.name === 'location') {
        // If location is empty or undefined, get previous day's value
        if (!entry || entry === '') {
          const previousDate = subDays(date, 1)
          const previousDateStr = format(previousDate, 'yyyy-MM-dd')
          const previousEntry = entries[previousDateStr]?.[metricId]
          if (previousEntry && previousEntry !== '' && previousEntry !== '-') {
            // Return previous day's value (will be auto-saved by useEffect)
            return previousEntry
          }
        }
      }
    }
    
    return entry
  }
  
  // Auto-populate location values from previous day (for Charter)
  useEffect(() => {
    if (currentUserId !== 'charter' || !metrics.length) return
    
    const locationMetric = metrics.find(m => m.name === 'location')
    if (!locationMetric) return
    
    let hasChanges = false
    const updatedEntries = { ...entries }
    
    // Check all days in the current month view
    const monthStart = startOfMonth(parseISO(date))
    const monthEnd = endOfMonth(parseISO(date))
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
    
    daysInMonth.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const currentEntry = updatedEntries[dateStr]?.[locationMetric.id]
      
      // If location is empty, check previous day
      if (!currentEntry || currentEntry === '') {
        const previousDate = subDays(day, 1)
        const previousDateStr = format(previousDate, 'yyyy-MM-dd')
        const previousEntry = updatedEntries[previousDateStr]?.[locationMetric.id]
        
        if (previousEntry && previousEntry !== '' && previousEntry !== '-') {
          // Auto-populate with previous day's value
          if (!updatedEntries[dateStr]) {
            updatedEntries[dateStr] = {}
          }
          updatedEntries[dateStr][locationMetric.id] = previousEntry
          hasChanges = true
          
          // Save to localStorage
          saveEntry(dateStr, updatedEntries[dateStr], currentUserId)
        }
      }
    })
    
    // Update state if there were changes
    if (hasChanges) {
      setEntries(updatedEntries)
    }
  }, [date, entries, metrics, currentUserId])

  const getCellValue = (day, metric) => {
    if (!day) return null
    const entry = getEntryForDate(day, metric.id)
    if (!entry) return ''
    
    // Return dash as-is if user manually entered it
    if (entry === '-') return '-'
    
    if (metric.inputType === 'binary') {
      return entry === 'yes' ? '1' : '0'
    }
    
    // For numeric and other types, return the value as-is
    return String(entry)
    return entry
  }

  const getCellColor = (day, metric, entryOverride = null) => {
    if (!day) return 'bg-white'
    const entry = entryOverride !== null ? entryOverride : getEntryForDate(day, metric.id)
    
    // If no entry or empty string, show white
    if (!entry || entry === '') {
      return 'bg-white text-slate-600'
    }
    
    // Convert entry to string for consistent comparison
    const entryStr = String(entry).trim()
    
    // Handle dash (manual entry)
    if (entryStr === '-') {
      return 'bg-slate-300 text-slate-700'
    }

    if (isBusinessDevHoursMetric(metric)) {
      const numValue = parseFloat(entryStr)
      if (!isNaN(numValue)) {
        if (numValue > 0) {
          return 'bg-green-600 text-white'
        } else if (numValue === 0) {
          return 'bg-red-400 text-white'
        }
      }
    }
    
    // ONLY apply green/red backgrounds for binary metrics
    if (metric.inputType === 'binary') {
      if (entryStr === 'yes' || entryStr === '1') {
        return 'bg-green-600 text-white'
      } else if (entryStr === 'no' || entryStr === '0') {
        return 'bg-red-400 text-white'
      }
    }
    
    // For numeric metrics, show green if value > 0, red if 0
    if (metric.inputType === 'numeric') {
      const numValue = parseFloat(entryStr)
      if (!isNaN(numValue)) {
        if (numValue > 0) {
          return 'bg-green-600 text-white'
        } else if (numValue === 0) {
          return 'bg-red-400 text-white'
        }
      }
    }
    
    // For text and other input types, always use white background and normal text color
    return 'bg-white text-slate-600'
  }

  const isCellSelected = (day, metric) => {
    if (!day) return false
    const dateStr = format(day, 'yyyy-MM-dd')
    
    // Check if cell is in selection range
    if (selectionRange) {
      const { start, end } = selectionRange
      const startDate = parseISO(start.date)
      const endDate = parseISO(end.date)
      const cellDate = parseISO(dateStr)
      
      const startMetricIdx = metrics.findIndex(m => m.id === start.metricId)
      const endMetricIdx = metrics.findIndex(m => m.id === end.metricId)
      const cellMetricIdx = metrics.findIndex(m => m.id === metric.id)
      
      if (startMetricIdx === -1 || endMetricIdx === -1 || cellMetricIdx === -1) return false
      
      const minDate = startDate < endDate ? startDate : endDate
      const maxDate = startDate > endDate ? startDate : endDate
      const minMetricIdx = Math.min(startMetricIdx, endMetricIdx)
      const maxMetricIdx = Math.max(startMetricIdx, endMetricIdx)
      
      const dateInRange = cellDate >= minDate && cellDate <= maxDate
      const metricInRange = cellMetricIdx >= minMetricIdx && cellMetricIdx <= maxMetricIdx
      
      return dateInRange && metricInRange
    }
    
    // Single cell selection
    if (!selectedCell) return false
    return selectedCell.date === dateStr && selectedCell.metricId === metric.id
  }
  
  // Get all cells in the current selection range
  const getSelectedCells = () => {
    if (!selectionRange) {
      if (!selectedCell) return []
      return [selectedCell]
    }
    
    const { start, end } = selectionRange
    const startDate = parseISO(start.date)
    const endDate = parseISO(end.date)
    
    const startMetricIdx = metrics.findIndex(m => m.id === start.metricId)
    const endMetricIdx = metrics.findIndex(m => m.id === end.metricId)
    
    if (startMetricIdx === -1 || endMetricIdx === -1) return []
    
    const minDate = startDate < endDate ? startDate : endDate
    const maxDate = startDate > endDate ? startDate : endDate
    const minMetricIdx = Math.min(startMetricIdx, endMetricIdx)
    const maxMetricIdx = Math.max(startMetricIdx, endMetricIdx)
    
    const selectedCells = []
    for (let metricIdx = minMetricIdx; metricIdx <= maxMetricIdx; metricIdx++) {
      const metric = metrics[metricIdx]
      if (!metric) continue
      
      for (let d = new Date(minDate); d <= maxDate; d = addDays(d, 1)) {
        selectedCells.push({
          date: format(d, 'yyyy-MM-dd'),
          metricId: metric.id
        })
      }
    }
    
    return selectedCells
  }

  const isCellEditing = (day, metric) => {
    if (!day || !editingCell) return false
    const dateStr = format(day, 'yyyy-MM-dd')
    return editingCell.date === dateStr && editingCell.metricId === metric.id
  }

  const displayAffirmationValue = stripLineNumbering(affirmationValue)
  const affirmationLines = displayAffirmationValue.split('\n')

  return (
    <div>
      <div className="flex items-center justify-between mb-4 pl-14">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
          Capture Data
        </h1>
          {/* Undo/Redo Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="p-2 rounded-lg border border-cyan-300/50 bg-white/80 backdrop-blur-sm hover:bg-cyan-50/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              title="Undo (Ctrl+Z)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L3 6.75m0 0l6-6m-6 6h12a6 6 0 010 12h-3" />
              </svg>
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className="p-2 rounded-lg border border-cyan-300/50 bg-white/80 backdrop-blur-sm hover:bg-cyan-50/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11.25l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-white/50 rounded-lg p-1 border border-cyan-300/50">
            <button
              onClick={() => setViewMode('form')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === 'form'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Form View
            </button>
            <button
              onClick={() => setViewMode('spreadsheet')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === 'spreadsheet'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Spreadsheet View
            </button>
          </div>
          
          {viewMode === 'form' ? (
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-4 py-2 border border-cyan-300/50 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 bg-white/80 backdrop-blur-sm transition-all glass"
            />
          ) : (
            <input
              type="month"
              value={format(selectedDateObj, 'yyyy-MM')}
              onChange={(e) => {
                const newDate = parseISO(e.target.value + '-01')
                setDate(format(newDate, 'yyyy-MM-dd'))
              }}
              className="px-4 py-2 border border-cyan-300/50 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 bg-white/80 backdrop-blur-sm transition-all glass"
            />
          )}
        </div>
      </div>

      {/* Form View */}
      {viewMode === 'form' && (
        <>
          {dueMetrics.length === 0 ? (
            <div className="glass rounded-2xl shadow-xl border border-cyan-200/50 p-8 text-center text-slate-500">
              No active metrics due for this date. Configure metrics first.
            </div>
          ) : (
            <div className="space-y-4">
              {dueMetrics.map((metric) => {
                // In form view, treat dashes as empty (don't show them)
                const rawValue = entries[metric.id] || ''
                const value = rawValue === '-' ? '' : rawValue
                return (
                  <div key={metric.id} className="glass rounded-2xl shadow-xl border border-cyan-200/50 p-6">
                    <label className="block text-lg font-semibold text-slate-800 mb-3">
                      {metric.name}
                          </label>
                    <p className="text-sm text-slate-600 mb-4">{metric.question}</p>
                    {metric.inputType === 'binary' ? (
                        <div className="flex gap-4">
                        <button
                          onClick={() => {
                            // If already selected, deselect it; otherwise select it
                            if (value === 'yes') {
                              handleInputChange(metric.id, '') // Clear if clicking the same button
                            } else {
                              handleInputChange(metric.id, 'yes') // Select yes
                            }
                          }}
                          className={`flex-1 px-6 py-4 rounded-xl font-medium transition-all ${
                            value === 'yes'
                              ? 'bg-green-500 text-white shadow-lg transform scale-105'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => {
                            // If already selected, deselect it; otherwise select it
                            if (value === 'no') {
                              handleInputChange(metric.id, '') // Clear if clicking the same button
                            } else {
                              handleInputChange(metric.id, 'no') // Select no
                            }
                          }}
                          className={`flex-1 px-6 py-4 rounded-xl font-medium transition-all ${
                            value === 'no'
                              ? 'bg-red-500 text-white shadow-lg transform scale-105'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          No
                        </button>
                        </div>
                    ) : metric.inputType === 'numeric' ? (
                        <input
                        type="number"
                          value={value}
                        onChange={(e) => handleInputChange(metric.id, e.target.value)}
                        onClick={(e) => {
                          // Clear any selected cell from spreadsheet
                          setSelectedCell(null)
                          setEditingCell(null)
                          setSelectionRange(null)
                          e.stopPropagation()
                        }}
                        onFocus={(e) => {
                          // Clear any selected cell from spreadsheet
                          setSelectedCell(null)
                          setEditingCell(null)
                          setSelectionRange(null)
                          e.stopPropagation()
                        }}
                        onKeyDown={(e) => {
                          // Stop propagation to prevent spreadsheet navigation when typing
                          e.stopPropagation()
                        }}
                        className="w-full px-4 py-2 border border-cyan-300/50 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 bg-white/80 backdrop-blur-sm transition-all glass text-lg"
                        placeholder="Enter a number"
                      />
                    ) : (
                      <textarea
                          value={value}
                        onChange={(e) => handleInputChange(metric.id, e.target.value)}
                        onClick={(e) => {
                          // Clear any selected cell from spreadsheet
                          setSelectedCell(null)
                          setEditingCell(null)
                          setSelectionRange(null)
                          e.stopPropagation()
                        }}
                        onFocus={(e) => {
                          // Clear any selected cell from spreadsheet
                          setSelectedCell(null)
                          setEditingCell(null)
                          setSelectionRange(null)
                          e.stopPropagation()
                        }}
                        onKeyDown={(e) => {
                          // Stop propagation to prevent spreadsheet navigation when typing
                          e.stopPropagation()
                        }}
                        rows={1}
                        className="w-full px-4 py-2 border border-cyan-300/50 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 bg-white/80 backdrop-blur-sm transition-all glass resize-none"
                        placeholder="Type your response..."
                        style={{ height: 'auto', minHeight: '2.5rem', maxHeight: 'none' }}
                        onInput={(e) => {
                          e.target.style.height = 'auto'
                          e.target.style.height = e.target.scrollHeight + 'px'
                        }}
                      />
                    )}
                  </div>
                )
              })}
              <div className="flex justify-end">
                <button
                  onClick={handleSave}
                  className="px-8 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg glow-hover font-medium"
                >
                  Save Entry
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Spreadsheet View */}
      {viewMode === 'spreadsheet' && (
        <>
          {metrics.length === 0 ? (
            <div className="glass rounded-2xl shadow-xl border border-cyan-200/50 p-8 text-center text-slate-500">
              No metrics configured. Configure metrics first.
            </div>
          ) : (
            <div className="glass rounded-2xl shadow-xl border border-cyan-200/50 overflow-hidden" style={{ padding: '10px' }}>
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse" style={{ tableLayout: 'fixed', width: '100%' }}>
                  <thead>
                    <tr className="bg-cyan-100/50 border-b-2 border-cyan-300/50">
                      <th className="sticky left-0 z-20 bg-cyan-100/50 px-0.5 py-2 text-left font-semibold text-slate-800 border-r-2 border-cyan-300/50 text-xs" style={{ 
                        width: habitsColumnWidth === 'auto' ? '200px' : habitsColumnWidth,
                        minWidth: habitsColumnWidth === 'auto' ? '200px' : habitsColumnWidth
                      }}>
                        HABITS
                      </th>
                      {allDays.map((day, idx) => {
                        const dayOfWeek = daysOfWeek[getDay(day)]
                        const isMonday = getDay(day) === 1 // Monday is 1 in date-fns
                        return (
                          <th key={day.toString()} className="px-1 py-2 text-center bg-cyan-100/50" style={{ 
                            width: habitsColumnWidth === 'auto' 
                              ? `calc((100% - 200px) / ${allDays.length})`
                              : `calc((100% - ${habitsColumnWidth}) / ${allDays.length})`,
                            minWidth: habitsColumnWidth === 'auto'
                              ? `calc((100% - 200px) / ${allDays.length})`
                              : `calc((100% - ${habitsColumnWidth}) / ${allDays.length})`,
                            borderLeft: isMonday ? '2px solid #000000' : (idx === 0 ? 'none' : '1px solid rgba(148, 163, 184, 0.3)')
                          }}>
                            <div className="text-xs font-medium text-slate-600">{dayOfWeek}</div>
                            <div className="text-xs font-semibold text-slate-800">{format(day, 'd')}</div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((metric, metricIdx) => {
                      const isRowSelected = selectedCell && selectedCell.metricId === metric.id && !editingCell
                      
                      return (
                      <tr 
                        key={metric.id} 
                        className={`${metricIdx % 2 === 0 ? 'bg-white/30' : 'bg-cyan-50/20'} ${
                          isRowSelected ? '' : 'border-b border-cyan-200/30'
                        } ${draggedMetricId === metric.id ? 'opacity-50' : ''} ${
                          dragOverIndex === metricIdx && draggedMetricId !== metric.id ? 'bg-blue-100/50' : ''
                        }`}
                        style={{ height: '100%' }}
                      >
                        <td 
                          className={`sticky left-0 z-10 px-0.5 py-1.5 text-xs font-medium text-slate-800 border-r-2 border-cyan-300/50 bg-inherit ${
                            editingHabitName && editingHabitName.metricId === metric.id ? 'cursor-text' : 'cursor-grab'
                          } ${
                            isRowSelected ? 'purple-row-border' : ''
                          } ${draggedMetricId === metric.id ? 'cursor-grabbing' : ''}`}
                          style={{ 
                            width: habitsColumnWidth === 'auto' ? '200px' : habitsColumnWidth,
                            minWidth: habitsColumnWidth === 'auto' ? '200px' : habitsColumnWidth,
                            height: '100%'
                          }}
                          draggable={!(editingHabitName && editingHabitName.metricId === metric.id)}
                          onDragStart={(e) => handleDragStart(e, metric.id)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleDragOver(e, metricIdx)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, metricIdx)}
                          onDoubleClick={() => {
                            if (!editingHabitName || editingHabitName.metricId !== metric.id) {
                              handleHabitNameDoubleClick(metric)
                            }
                          }}
                        >
                          <div className="flex items-center gap-0.5">
                            <svg 
                              xmlns="http://www.w3.org/2000/svg" 
                              className="h-3 w-3 text-slate-400 flex-shrink-0 pointer-events-none" 
                              fill="none" 
                              viewBox="0 0 24 24" 
                              stroke="currentColor" 
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
                            </svg>
                            {editingHabitName && editingHabitName.metricId === metric.id ? (
                        <input
                          type="text"
                                value={editingHabitName.name}
                                onChange={(e) => setEditingHabitName({ ...editingHabitName, name: e.target.value })}
                                onBlur={() => handleHabitNameSave(metric.id, editingHabitName.name)}
                          onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleHabitNameSave(metric.id, editingHabitName.name)
                                  } else if (e.key === 'Escape') {
                                    setEditingHabitName(null)
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onDoubleClick={(e) => e.stopPropagation()}
                                className="whitespace-nowrap text-xs flex-1 border border-cyan-300 rounded px-1 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                style={{ 
                                  fontWeight: '600',
                                  lineHeight: '1.2',
                                  fontSize: '0.75rem'
                                }}
                          autoFocus
                        />
                            ) : (
                              <div 
                                data-habit-name
                                className="whitespace-nowrap text-xs" 
                                style={{ 
                                  fontWeight: '600',
                                  lineHeight: '1.2',
                                  fontSize: '0.75rem'
                                }}
                              >
                                {metric.name}
                      </div>
                            )}
                          </div>
                        </td>
                        {allDays.map((day, dayIdx) => {
                          const value = getCellValue(day, metric)
                          const entry = getEntryForDate(day, metric.id)
                          const isSelected = isCellSelected(day, metric)
                          const isEditing = isCellEditing(day, metric)
                          const isEmpty = !entry || entry === ''
                          const entryForColor = isEditing ? editValue : entry
                          const cellColor = getCellColor(day, metric, entryForColor)
                          // Selected cells always get blue border - keep it visible even when popup is open
                          const shouldShowBlueBorder = isSelected
                          const isMonday = getDay(day) === 1 // Monday is 1 in date-fns
                          
                          return (
                            <td
                              key={day.toString()}
                              data-date={format(day, 'yyyy-MM-dd')}
                              data-metric-id={metric.id}
                              onClick={(e) => {
                                // For text/time cells, start editing on click
                                if ((metric.inputType === 'text' || metric.inputType === 'time') && !editingCell) {
                                  const dateStr = format(day, 'yyyy-MM-dd')
                                  const currentValue = entries[dateStr]?.[metric.id] || ''
                                  setSelectedCell({ date: dateStr, metricId: metric.id })
                                  setEditingCell({ date: dateStr, metricId: metric.id, metric })
                                  setEditValue(currentValue.toString())
                                } else {
                                  handleCellClick(day, metric, e)
                                }
                              }}
                              onMouseDown={(e) => handleCellMouseDown(day, metric, e)}
                              onDoubleClick={(e) => {
                                // For text/time cells, double-click just focuses the input (already editing)
                                if (metric.inputType === 'text' || metric.inputType === 'time') {
                                  if (editingCell && editingCell.date === format(day, 'yyyy-MM-dd') && editingCell.metricId === metric.id) {
                                    // Already editing, just focus
                                    return
                                  }
                                  // Start editing
                                  const dateStr = format(day, 'yyyy-MM-dd')
                                  const currentValue = entries[dateStr]?.[metric.id] || ''
                                  setSelectedCell({ date: dateStr, metricId: metric.id })
                                  setEditingCell({ date: dateStr, metricId: metric.id, metric })
                                  setEditValue(currentValue.toString())
                                } else {
                                  // For other cell types, open popup
                                  handleCellDoubleClick(day, metric, e.currentTarget)
                                }
                              }}
                              className={`px-1 py-1.5 text-center text-xs relative transition-all cursor-cell ${cellColor} ${
                                !isSelected ? 'hover:ring-4 hover:ring-blue-600 hover:ring-opacity-100 hover:shadow-lg' : ''
                              }`}
                              style={{
                                width: habitsColumnWidth === 'auto'
                                  ? `calc((100% - 200px) / ${allDays.length})`
                                  : `calc((100% - ${habitsColumnWidth}) / ${allDays.length})`,
                                minWidth: habitsColumnWidth === 'auto'
                                  ? `calc((100% - 200px) / ${allDays.length})`
                                  : `calc((100% - ${habitsColumnWidth}) / ${allDays.length})`,
                                border: '1px solid rgba(148, 163, 184, 0.3)',
                                borderLeft: isMonday ? '2px solid #000000' : '1px solid rgba(148, 163, 184, 0.3)',
                                outline: shouldShowBlueBorder ? '1.75px solid #1a73e8' : 'none',
                                outlineOffset: shouldShowBlueBorder ? '-1px' : '0',
                                position: 'relative',
                                boxSizing: 'border-box',
                                zIndex: shouldShowBlueBorder ? 5 : 'auto',
                                overflow: 'hidden'
                              }}
                              title={`Click to select, double-click to edit - ${format(day, 'MMM d, yyyy')}`}
                            >
                              {(
                                <>
                                  {shouldShowBlueBorder && (
                                    <div className="cell-selected-overlay" />
                                  )}
                                  {isEditing && (metric.inputType === 'text' || metric.inputType === 'time') ? (
                      <input
                                      ref={editInputRef}
                                      type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                          e.preventDefault()
                                          handleCellSave()
                                          // Move to next row (down)
                                          const currentMetricIdx = metrics.findIndex(m => m.id === metric.id)
                                          const nextMetricIdx = Math.min(metrics.length - 1, currentMetricIdx + 1)
                                          const nextMetric = metrics[nextMetricIdx]
                                          if (nextMetric) {
                                            setSelectedCell({ date: format(day, 'yyyy-MM-dd'), metricId: nextMetric.id })
                                          }
                                        } else if (e.key === 'Escape') {
                                          e.preventDefault()
                                          handleCellCancel()
                                        }
                                        e.stopPropagation()
                                      }}
                                      onBlur={() => {
                                        handleCellSave()
                                      }}
                                      onClick={(e) => {
                                        // Clear selection range when clicking in input
                                        setSelectionRange(null)
                                        e.stopPropagation()
                                      }}
                                      onFocus={(e) => {
                                        // Clear selection range when focusing input
                                        setSelectionRange(null)
                                        e.stopPropagation()
                                      }}
                                      style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        width: '100%',
                                        height: '100%',
                                        border: 'none',
                                        outline: 'none',
                                        background: 'transparent',
                                        textAlign: 'center',
                                        fontSize: '0.75rem',
                                        padding: '0.375rem 0.25rem',
                                        zIndex: 10
                                      }}
                      />
                    ) : (
                                    <span 
                                      data-cell-value
                                      className="block text-center"
                                      style={{ 
                                        position: 'relative', 
                                        zIndex: 2,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        maxWidth: '100%',
                                        width: '100%',
                                        display: 'block'
                                      }}
                                      ref={(el) => {
                                        if (el && value) {
                                          setTimeout(() => resizeTextToFit(el, String(value), 6, 12), 0)
                                        }
                                      }}
                                    >
                                      {value || ''}
                                    </span>
                                  )}
                                  {shouldShowBlueBorder && !isEditing && (
                                    <div 
                                      className="cell-selected-fill-handle"
                                      onMouseDown={(e) => {
                                        e.stopPropagation()
                                        handleFillHandleDragStart(e, day, metric)
                                      }}
                                    />
                                  )}
                                </>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
                
                {/* Cell Edit Popup Overlay - rendered via portal to avoid parent container issues */}
                {popupPosition && editingCell && createPortal(
                  <>
                    {/* Backdrop to close on outside click */}
                    <div
                      style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 40
                      }}
                      onClick={handleCellCancel}
                    />
                    {/* Popup */}
                    <div
                      style={{
                        position: 'fixed',
                        left: `${popupPosition.x}px`,
                        top: `${popupPosition.y}px`,
                        width: `${popupPosition.cellWidth * 6}px`,
                        height: `${popupPosition.cellHeight * 2}px`,
                        padding: '8px',
                        maxWidth: '90vw',
                        maxHeight: '90vh',
                        boxSizing: 'border-box',
                        margin: 0,
                        border: '2px solid rgb(168, 85, 247)',
                        borderRadius: '0.5rem',
                        backgroundColor: 'white',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        zIndex: 50,
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <textarea
                        ref={popupInputRef}
                        value={editValue}
                        onChange={(e) => {
                          setEditValue(e.target.value)
                          // Stop propagation to prevent any parent handlers from interfering
                          e.stopPropagation()
                        }}
                        onKeyDown={handlePopupKeyDown}
                        onKeyPress={(e) => {
                          // Stop propagation for all key presses to prevent navigation
                          e.stopPropagation()
                        }}
                        onClick={(e) => {
                          // Stop propagation to prevent any click handlers from interfering
                          e.stopPropagation()
                        }}
                        style={{ 
                          flex: '1 1 auto',
                          width: '100%',
                          padding: '8px',
                          fontSize: '0.875rem',
                          border: 'none',
                          outline: 'none',
                          resize: 'none',
                          fontFamily: 'inherit',
                          minHeight: 0,
                          overflow: 'auto',
                          margin: 0
                        }}
                        placeholder="Enter value... (Press Enter to save and move to next cell)"
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '4px', flexShrink: 0 }}>
                        <button
                          onClick={() => handlePopupSave(false)} // Don't move to next when clicking button
                          style={{
                            padding: '6px',
                            backgroundColor: 'rgb(34, 197, 94)',
                            color: 'white',
                            borderRadius: '9999px',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(22, 163, 74)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(34, 197, 94)'}
                          title="Save (Enter)"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </>,
                  document.body
                )}
                
                {/* Add Habit Button Row with Date Navigation */}
                <div className="border-t border-cyan-200/30 bg-cyan-50/30 p-2">
                  <div className="flex items-center justify-between gap-4">
                      <button
                      onClick={() => setShowAddHabitModal(true)}
                      className="py-2 px-4 text-sm font-medium text-cyan-700 hover:text-cyan-900 hover:bg-cyan-100/50 rounded-lg transition-all flex items-center gap-2"
                      >
                      <span className="text-lg">+</span>
                      <span>Add Habit</span>
                      </button>
                    {/* Date Navigation for Reflections */}
                    {reflectionConfig && (
                <div className="flex items-center gap-2">
                      <button
                          onClick={() => {
                            const newDate = subDays(parseISO(date), 1)
                            setDate(format(newDate, 'yyyy-MM-dd'))
                          }}
                          className="px-3 py-1 bg-white/80 border border-cyan-300/50 rounded-lg hover:bg-cyan-50 transition-all"
                        >
                          ←
                        </button>
                        <span className="text-sm font-medium text-slate-700 px-2">
                          {format(parseISO(date), 'MMM d, yyyy')}
                        </span>
                        <button
                          onClick={() => {
                            const newDate = addDays(parseISO(date), 1)
                            setDate(format(newDate, 'yyyy-MM-dd'))
                          }}
                          className="px-3 py-1 bg-white/80 border border-cyan-300/50 rounded-lg hover:bg-cyan-50 transition-all"
                        >
                          →
                      </button>
                    </div>
                    )}
                  </div>
                </div>
                </div>
              
              {/* Reflection Fields Section */}
              {reflectionConfig && (
              <div className="mt-3 space-y-3">
                
                {/* Daily Reflection Fields */}
                <div className="flex gap-4">
                  {reflectionConfig.fields
                    .sort((a, b) => a.order - b.order)
                    .map((field) => {
                      const isEditing = editingReflectionField?.fieldId === field.id
                      const fieldValue = currentReflections[field.id] || ''
                      
                      const isReflectionField = ['PROUD', 'FORGIVE', 'GRATEFUL'].includes(field.label.toUpperCase())
                      const displayValue = isReflectionField ? stripLineNumbering(fieldValue) : fieldValue
                      const reflectionLines = displayValue.split('\n')
                      
                      const handleCopyFromPreviousDay = () => {
                        const currentDateObj = parseISO(date)
                        const allReflections = getAllReflections(currentUserId)
                        
                        // Look back up to 30 days to find the most recent day with reflection data
                        for (let i = 1; i <= 30; i++) {
                          const previousDate = subDays(currentDateObj, i)
                          const previousDateStr = format(previousDate, 'yyyy-MM-dd')
                          const previousReflections = allReflections[previousDateStr]
                          
                          if (previousReflections && previousReflections[field.id] && previousReflections[field.id].trim() !== '') {
                            // Copy the value from previous day
                            const preFilledValue = isReflectionField
                              ? stripLineNumbering(previousReflections[field.id])
                              : previousReflections[field.id]
                            const updated = { 
                              ...currentReflections, 
                              [field.id]: preFilledValue
                            }
                            setCurrentReflections(updated)
                            saveReflections(date, updated, currentUserId)
                            
                            // Resize textarea after copying
                            setTimeout(() => {
                              const textarea = document.querySelector(`textarea[data-field-id="${field.id}"]`)
                              if (textarea) {
                                textarea.style.height = 'auto'
                                textarea.style.height = Math.max(60, textarea.scrollHeight) + 'px'
                              }
                            }, 0)
                            return
                          }
                        }
                      }
                      
                        return (
                        <div key={field.id} className="flex-1">
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            <div className="flex items-center gap-2">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editingReflectionField?.value || field.label}
                                  onChange={(e) => setEditingReflectionField({ fieldId: field.id, value: e.target.value })}
                                  onClick={(e) => {
                                    setSelectedCell(null)
                                    setEditingCell(null)
                                    setSelectionRange(null)
                                    e.stopPropagation()
                                  }}
                                  onFocus={(e) => {
                                    setSelectedCell(null)
                                    setEditingCell(null)
                                    setSelectionRange(null)
                                    e.stopPropagation()
                                  }}
                                  onBlur={() => {
                                    if (editingReflectionField?.value && editingReflectionField.value !== field.label) {
                                      const updatedConfig = {
                                        ...reflectionConfig,
                                        fields: reflectionConfig.fields.map(f => 
                                          f.id === field.id ? { ...f, label: editingReflectionField.value } : f
                                        )
                                      }
                                      saveReflectionConfig(updatedConfig, currentUserId)
                                      setReflectionConfig(updatedConfig)
                                    }
                                    setEditingReflectionField(null)
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.target.blur()
                                    }
                                  }}
                                  className="w-full px-2 py-1 border border-cyan-300 rounded text-sm font-semibold"
                                  autoFocus
                                />
                              ) : (
                                <span 
                                  onDoubleClick={() => setEditingReflectionField({ fieldId: field.id, value: field.label })}
                                  className="cursor-pointer hover:bg-cyan-50 px-2 py-1 rounded"
                                >
                                  {field.label}
                                </span>
                              )}
                              {isReflectionField && !isEditing && (
                                <button
                                  onClick={handleCopyFromPreviousDay}
                                  className="p-1 hover:bg-cyan-100 rounded transition-colors"
                                  title="Copy from previous day"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </label>
                          <div className="relative">
                            {isReflectionField && focusedReflectionFieldId === field.id && (
                              <div className="pointer-events-none select-none absolute left-3 top-2 bottom-2 flex flex-col text-base leading-6">
                                {reflectionLines.map((line, index) => (
                                  <div
                                    key={`${field.id}-line-${index}`}
                                    className={line.trim() === '' ? 'text-slate-400' : 'text-slate-700'}
                                  >
                                    {index + 1}.
                                  </div>
                                ))}
                              </div>
                            )}
                            <textarea
                              value={displayValue}
                              onClick={(e) => {
                                // Clear any selected cell from spreadsheet
                                setSelectedCell(null)
                                setEditingCell(null)
                                setSelectionRange(null)
                                e.stopPropagation()
                              }}
                              onFocus={(e) => {
                                // Clear any selected cell from spreadsheet
                                setSelectedCell(null)
                                setEditingCell(null)
                                setSelectionRange(null)
                                setFocusedReflectionFieldId(field.id)
                                
                                // Feature flag: Enable/disable pre-population from previous day
                                const ENABLE_PREVIOUS_DAY_POPULATION = false // Set to true to enable
                                
                                // If field is empty and it's a reflection field, look for previous day's data
                                // Works for any date (past, present, or future)
                                if (ENABLE_PREVIOUS_DAY_POPULATION && isReflectionField && (!displayValue || displayValue.trim() === '')) {
                                  const currentDateObj = parseISO(date)
                                  const allReflections = getAllReflections(currentUserId)
                                  
                                  // Look back up to 30 days to find the most recent day with reflection data
                                  for (let i = 1; i <= 30; i++) {
                                    const previousDate = subDays(currentDateObj, i)
                                    const previousDateStr = format(previousDate, 'yyyy-MM-dd')
                                    const previousReflections = allReflections[previousDateStr]
                                    
                                    if (previousReflections && previousReflections[field.id] && previousReflections[field.id].trim() !== '') {
                                      // Copy the value from previous day
                                      const preFilledValue = isReflectionField
                                        ? stripLineNumbering(previousReflections[field.id])
                                        : previousReflections[field.id]
                                      const updated = { 
                                        ...currentReflections, 
                                        [field.id]: preFilledValue
                                      }
                                      setCurrentReflections(updated)
                                      saveReflections(date, updated, currentUserId)
                                      
                                      // Resize textarea after setting value
                                      setTimeout(() => {
                                        e.target.style.height = 'auto'
                                        e.target.style.height = Math.max(60, e.target.scrollHeight) + 'px'
                                        e.target.setSelectionRange(preFilledValue.length, preFilledValue.length)
                                      }, 0)
                                      return
                                    }
                                  }
                                }
                                
                                if (isReflectionField) {
                                  const normalizedValue = stripLineNumbering(fieldValue)
                                  if (normalizedValue !== fieldValue) {
                                    const updated = { ...currentReflections, [field.id]: normalizedValue }
                                    setCurrentReflections(updated)
                                    saveReflections(date, updated, currentUserId)
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                const value = e.target.value
                                setFocusedReflectionFieldId(null)
                                
                                // Ensure textarea height is correct on blur
                                e.target.style.height = 'auto'
                                if (value && value.trim() !== '') {
                                  e.target.style.height = Math.max(60, e.target.scrollHeight) + 'px'
                                } else {
                                  e.target.style.height = '60px'
                                }
                              }}
                              onChange={(e) => {
                                const value = e.target.value
                                const sanitizedValue = isReflectionField ? stripLineNumbering(value) : value
                                const updated = { ...currentReflections, [field.id]: sanitizedValue }
                                setCurrentReflections(updated)
                                saveReflections(date, updated, currentUserId)
                                
                                // Auto-resize textarea
                                e.target.style.height = 'auto'
                                if (sanitizedValue && sanitizedValue.trim() !== '') {
                                  e.target.style.height = Math.max(60, e.target.scrollHeight) + 'px'
                                } else {
                                  e.target.style.height = '60px'
                                }
                              }}
                              onPaste={(e) => {
                                // Allow default paste behavior, then adjust height
                                setTimeout(() => {
                                  e.target.style.height = 'auto'
                                  e.target.style.height = e.target.scrollHeight + 'px'
                                }, 0)
                              }}
                              onKeyDown={(e) => {
                                // Stop propagation to prevent spreadsheet navigation when typing
                                e.stopPropagation()
                                if (e.key === 'Enter' && isReflectionField) {
                                  if (isCurrentLineEmpty(e.target.value, e.target.selectionStart)) {
                                    e.preventDefault()
                                  }
                                }
                              }}
                              data-field-id={field.id}
                              data-reflection-field="true"
                              className={`w-full py-2 pr-4 border-2 border-black rounded-lg resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-black text-base leading-6${isReflectionField ? ' pl-10' : ' px-4'}`}
                              style={{
                                height: displayValue && displayValue.trim() !== '' 
                                  ? 'auto' 
                                  : '60px',
                                minHeight: '60px'
                              }}
                              onInput={(e) => {
                                e.target.style.height = 'auto'
                                if (e.target.value && e.target.value.trim() !== '') {
                                  e.target.style.height = Math.max(60, e.target.scrollHeight) + 'px'
                                } else {
                                  e.target.style.height = '60px'
                                }
                              }}
                              ref={(el) => {
                                // Auto-resize on mount and when value changes
                                if (el) {
                                  setTimeout(() => {
                                    el.style.height = 'auto'
                                    if (el.value && el.value.trim() !== '') {
                                      el.style.height = Math.max(60, el.scrollHeight) + 'px'
                                    } else {
                                      el.style.height = '60px'
                                    }
                                  }, 0)
                                }
                              }}
                              placeholder={
                                currentUserId === 'charter' && (field.label === 'JOURNAL' || field.label === 'EXERCISE')
                                  ? ''
                                  : field.label === 'PROUD'
                                  ? 'I am proud of myself for'
                                  : field.label === 'FORGIVE'
                                  ? 'I forgive myself for'
                                  : 'I am grateful for'
                              }
                            />
                          </div>
                </div>
                      )
                    })}
              </div>
              
                {/* Affirmation Field */}
                {reflectionConfig.showAffirmation && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      MY DAILY AFFIRMATION/S
                    </label>
                    {editingAffirmation ? (
                      <div className="relative">
                        <div className="pointer-events-none select-none absolute left-3 top-2 bottom-2 flex flex-col text-base leading-6">
                          {affirmationLines.map((line, index) => (
                            <div
                              key={`affirmation-line-${index}`}
                              className={line.trim() === '' ? 'text-slate-400' : 'text-slate-700'}
                            >
                              {index + 1}.
                            </div>
                          ))}
                        </div>
                        <textarea
                          value={displayAffirmationValue}
                          onChange={(e) => setAffirmationValue(stripLineNumbering(e.target.value))}
                          onClick={(e) => {
                            // Clear any selected cell from spreadsheet
                            setSelectedCell(null)
                            setEditingCell(null)
                            setSelectionRange(null)
                            e.stopPropagation()
                          }}
                          onPaste={(e) => {
                            // Allow default paste behavior, then adjust height
                            setTimeout(() => {
                              e.target.style.height = 'auto'
                              e.target.style.height = e.target.scrollHeight + 'px'
                            }, 0)
                          }}
                          onFocus={(e) => {
                            // Clear any selected cell from spreadsheet
                            setSelectedCell(null)
                            setEditingCell(null)
                            setSelectionRange(null)
                            e.stopPropagation()
                            
                            const normalizedValue = stripLineNumbering(affirmationValue)
                            if (normalizedValue !== affirmationValue) {
                              setAffirmationValue(normalizedValue)
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setEditingAffirmation(false)
                              setAffirmationValue(getAffirmation(currentUserId))
                            } else if (e.key === 'Enter') {
                              if (isCurrentLineEmpty(e.target.value, e.target.selectionStart)) {
                                e.preventDefault()
                              }
                            }
                          }}
                          onBlur={() => {
                            const valueToSave = displayAffirmationValue
                            saveAffirmation(valueToSave, currentUserId)
                            setEditingAffirmation(false)
                          }}
                          className="w-full py-2 pr-4 border-2 border-black rounded-lg resize-none overflow-hidden min-h-[30px] focus:outline-none focus:ring-2 focus:ring-black bg-white pl-10 text-base leading-6"
                          style={{
                            height: 'auto',
                            minHeight: '30px',
                            borderRadius: '0.5rem'
                          }}
                          onInput={(e) => {
                            e.target.style.height = 'auto'
                            e.target.style.height = e.target.scrollHeight + 'px'
                          }}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div
                        onDoubleClick={() => setEditingAffirmation(true)}
                        className="w-full px-4 py-2 border-2 border-black rounded-lg bg-white min-h-[30px] cursor-pointer hover:bg-gray-50 transition-colors"
                        style={{
                          borderRadius: '0.5rem',
                          boxSizing: 'border-box'
                        }}
                      >
                        {affirmationValue || <span className="text-slate-400">Double-click to add your daily affirmation/s (you only need to do this once if you want)</span>}
                </div>
                    )}
                </div>
                )}
                </div>
              )}
                </div>
          )}
        </>
      )}

      {/* Add Habit Modal */}
      {showAddHabitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddHabitModal(false)}>
          <div className="glass rounded-2xl shadow-xl border border-cyan-200/50 p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-semibold mb-4 text-slate-800">Add New Habit</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Habit Name
                </label>
                <input
                  type="text"
                  value={newHabitForm.name}
                  onChange={(e) => setNewHabitForm({ ...newHabitForm, name: e.target.value })}
                  onClick={(e) => {
                    // Clear any selected cell from spreadsheet
                    setSelectedCell(null)
                    setEditingCell(null)
                    setSelectionRange(null)
                    e.stopPropagation()
                  }}
                  onFocus={(e) => {
                    // Clear any selected cell from spreadsheet
                    setSelectedCell(null)
                    setEditingCell(null)
                    setSelectionRange(null)
                    e.stopPropagation()
                  }}
                  onKeyDown={(e) => {
                    // Stop propagation to prevent spreadsheet navigation when typing
                    e.stopPropagation()
                  }}
                  className="w-full px-4 py-2 border border-cyan-300/50 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 bg-white/80 backdrop-blur-sm transition-all"
                  placeholder="e.g., Exercise"
                  autoFocus
                />
                </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Question (Optional)
                </label>
                <input
                  type="text"
                  value={newHabitForm.question}
                  onChange={(e) => setNewHabitForm({ ...newHabitForm, question: e.target.value })}
                  onClick={(e) => {
                    // Clear any selected cell from spreadsheet
                    setSelectedCell(null)
                    setEditingCell(null)
                    setSelectionRange(null)
                    e.stopPropagation()
                  }}
                  onFocus={(e) => {
                    // Clear any selected cell from spreadsheet
                    setSelectedCell(null)
                    setEditingCell(null)
                    setSelectionRange(null)
                    e.stopPropagation()
                  }}
                  onKeyDown={(e) => {
                    // Stop propagation to prevent spreadsheet navigation when typing
                    e.stopPropagation()
                  }}
                  className="w-full px-4 py-2 border border-cyan-300/50 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 bg-white/80 backdrop-blur-sm transition-all"
                  placeholder="e.g., Did you exercise today?"
                />
                </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Input Type
                  </label>
                  <select
                    value={newHabitForm.inputType}
                    onChange={(e) => setNewHabitForm({ ...newHabitForm, inputType: e.target.value })}
                    className="w-full px-4 py-2 border border-cyan-300/50 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 bg-white/80 backdrop-blur-sm transition-all"
                  >
                    <option value="binary">Binary (Yes/No)</option>
                    <option value="numeric">Numeric</option>
                    <option value="short_text">Short Text</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Frequency
                  </label>
                  <select
                    value={newHabitForm.frequency}
                    onChange={(e) => setNewHabitForm({ ...newHabitForm, frequency: e.target.value })}
                    className="w-full px-4 py-2 border border-cyan-300/50 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 bg-white/80 backdrop-blur-sm transition-all"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekdays">Weekdays</option>
                    <option value="weekends">Weekends</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleAddHabit}
                  disabled={!newHabitForm.name.trim()}
                  className="flex-1 px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg glow-hover font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Habit
                </button>
                <button
                  onClick={() => {
                    setShowAddHabitModal(false)
                    setNewHabitForm({
                      name: '',
                      question: '',
                      inputType: 'binary',
                      frequency: 'daily',
                      active: true
                    })
                  }}
                  className="px-6 py-2 bg-slate-200/80 text-slate-700 rounded-xl hover:bg-slate-300/80 transition-all backdrop-blur-sm"
                >
                  Cancel
                </button>
              </div>
                </div>
              </div>
            </div>
      )}
    </div>
  )
}
