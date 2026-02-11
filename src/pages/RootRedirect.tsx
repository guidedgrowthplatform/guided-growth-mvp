import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function RootRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    // Check if this is an OAuth callback (has access_token in hash)
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      // Redirect to /auth/callback with the hash
      navigate(`/auth/callback${hash}`, { replace: true })
    } else {
      // Normal redirect to login
      navigate('/login', { replace: true })
    }
  }, [navigate])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p>Loading...</p>
      </div>
    </div>
  )
}
