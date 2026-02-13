import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { storeSession, getSession } from '../lib/auth'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const token = searchParams.get('token')
        const error = searchParams.get('error')

        if (error) {
          console.error('OAuth error:', error)
          navigate('/login?error=oauth_failed')
          return
        }

        if (!token) {
          navigate('/login?error=no_token')
          return
        }

        // Verify and get user info from token
        const user = await getSession(token)
        
        if (!user) {
          navigate('/login?error=invalid_token')
          return
        }

        // Store the session token
        storeSession(token)
        
        // Redirect to dashboard
        navigate('/dashboard', { replace: true })
      } catch (err) {
        console.error('Callback error:', err)
        navigate('/login?error=callback_failed')
      }
    }

    handleAuthCallback()
  }, [navigate, searchParams])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p>Completing sign in...</p>
      </div>
    </div>
  )
}
