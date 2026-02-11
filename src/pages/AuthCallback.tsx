import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // First, try to get the session directly (similar to the snippet you provided)
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session) {
          navigate('/dashboard', { replace: true })
          return
        }

        // If there's no session yet, fall back to inspecting the URL hash for errors
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const errorParam = hashParams.get('error')

        if (errorParam) {
          console.error('OAuth error:', errorParam)
          navigate('/login?error=oauth_failed')
          return
        }

        // Still no session and no explicit error – send user back to login
        navigate('/login')
      } catch (err) {
        console.error('Callback error:', err)
        navigate('/login?error=callback_failed')
      }
    }

    handleAuthCallback()
  }, [navigate])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p>Completing sign in...</p>
      </div>
    </div>
  )
}
