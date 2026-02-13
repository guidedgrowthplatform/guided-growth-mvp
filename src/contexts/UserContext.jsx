import { createContext, useContext, useState, useEffect } from 'react'
import { getCurrentUserId, setCurrentUserId as saveCurrentUserId, getUsers } from '../utils/users'
import { initializeSampleData, initializeYairData, initializeCharterData } from '../utils/storage'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [currentUserId, setCurrentUserIdState] = useState(null)
  const [users, setUsersState] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      // Initialize users and current user
      const allUsers = getUsers()
      setUsersState(allUsers)
      
      let userId = getCurrentUserId()
      if (!userId) {
        if (allUsers.length > 0) {
          // Set first user as default
          userId = allUsers[0].id
          saveCurrentUserId(userId)
        } else {
          // Should not happen if getUsers works correctly, but handle it
          console.error('No users found')
        }
      }
      
      if (userId) {
        setCurrentUserIdState(userId)
        // Initialize user data only if it doesn't exist (first time setup)
        // This prevents data loss when switching users
        if (userId === 'yair') {
          initializeYairData(userId)
        } else if (userId === 'charter') {
          initializeCharterData(userId)
        } else {
          // Initialize sample data for other users if needed
          initializeSampleData(userId)
        }
      }
    } catch (error) {
      console.error('Error initializing users:', error)
      // Fallback: try to get users and set first one
      try {
        const allUsers = getUsers()
        if (allUsers.length > 0) {
          const userId = allUsers[0].id
          saveCurrentUserId(userId)
          setCurrentUserIdState(userId)
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const setCurrentUserId = (userId) => {
    saveCurrentUserId(userId)
    setCurrentUserIdState(userId)
    // Initialize user data only if it doesn't exist (first time setup)
    // This prevents data loss when switching users
    if (userId === 'yair') {
      initializeYairData(userId)
    } else if (userId === 'charter') {
      initializeCharterData(userId)
    } else {
      initializeSampleData(userId)
    }
    // Force reload to update all components
    window.location.reload()
  }

  const currentUser = users.find(u => u.id === currentUserId) || null

  // Show loading state or ensure we have a user before rendering
  if (isLoading || !currentUserId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-cyan-50 to-blue-100">
        <div className="text-center">
          <div className="text-2xl font-bold text-cyan-600 mb-2">Loading...</div>
          <div className="text-sm text-slate-500">Initializing user data</div>
        </div>
      </div>
    )
  }

  return (
    <UserContext.Provider value={{ currentUser, currentUserId, users, setCurrentUserId }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
