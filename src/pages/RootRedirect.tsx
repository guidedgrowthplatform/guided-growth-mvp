import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function RootRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    const hash = window.location.hash

    if (hash && hash.includes('access_token')) {
      // OAuth callback landed at root (/#access_token=...)
      // Send it to the real callback route so AuthCallback can process it
      navigate(`/auth/callback${hash}`, { replace: true })
    } else {
      // Normal case: just go to login
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
