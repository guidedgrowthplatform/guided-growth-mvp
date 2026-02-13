import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStoredSession, signOut, type User } from '../lib/auth'

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const session = getStoredSession()
    
    if (!session) {
      navigate('/login')
      return
    }
    
    setUser(session)
  }, [navigate])

  const handleSignOut = () => {
    signOut()
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h1>Welcome to Guided Growth!</h1>
      <p>You are signed in as: {user.email}</p>
      <button onClick={handleSignOut}>
        Sign Out
      </button>
    </div>
  )
}
