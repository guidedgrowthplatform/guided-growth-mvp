// User management utilities

const USERS_KEY = 'life_tracker_users'
const CURRENT_USER_KEY = 'life_tracker_current_user'
const USER_PREFERENCES_KEY = 'life_tracker_user_preferences'

// Default users
const DEFAULT_USERS = [
  {
    id: 'yair',
    name: 'Yair',
    createdAt: new Date().toISOString()
  },
  {
    id: 'charter',
    name: 'Charter',
    createdAt: new Date().toISOString()
  }
]

// Default view preferences per user (all default to spreadsheet)
const DEFAULT_VIEW_PREFERENCES = {
  yair: 'spreadsheet',
  charter: 'spreadsheet'
}

export function getUsers() {
  const stored = localStorage.getItem(USERS_KEY)
  if (!stored) {
    // Initialize with default users
    localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS))
    return DEFAULT_USERS
  }
  return JSON.parse(stored)
}

export function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function getCurrentUserId() {
  const stored = localStorage.getItem(CURRENT_USER_KEY)
  if (!stored) {
    // Set first user as default
    const users = getUsers()
    if (users.length > 0) {
      setCurrentUserId(users[0].id)
      return users[0].id
    }
    return null
  }
  return stored
}

export function setCurrentUserId(userId) {
  localStorage.setItem(CURRENT_USER_KEY, userId)
}

export function getCurrentUser() {
  const userId = getCurrentUserId()
  if (!userId) return null
  const users = getUsers()
  return users.find(u => u.id === userId) || null
}

export function addUser(name) {
  const users = getUsers()
  const newUser = {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name: name,
    createdAt: new Date().toISOString()
  }
  users.push(newUser)
  saveUsers(users)
  return newUser
}

export function deleteUser(userId) {
  const users = getUsers()
  const filtered = users.filter(u => u.id !== userId)
  saveUsers(filtered)
  
  // If deleted user was current, switch to first available user
  if (getCurrentUserId() === userId && filtered.length > 0) {
    setCurrentUserId(filtered[0].id)
  }
}

export function getUserViewPreference(userId) {
  if (!userId) return 'spreadsheet' // Default fallback
  const prefs = getUserPreferences()
  return prefs[userId]?.viewMode || DEFAULT_VIEW_PREFERENCES[userId] || 'spreadsheet'
}

export function setUserViewPreference(userId, viewMode) {
  const prefs = getUserPreferences()
  prefs[userId] = { ...prefs[userId], viewMode }
  localStorage.setItem(USER_PREFERENCES_KEY, JSON.stringify(prefs))
}

function getUserPreferences() {
  const stored = localStorage.getItem(USER_PREFERENCES_KEY)
  return stored ? JSON.parse(stored) : {}
}
