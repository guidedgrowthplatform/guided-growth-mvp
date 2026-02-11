import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check for OAuth error in hash first
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const errorParam = hashParams.get('error')
        
        if (errorParam) {
          console.error('OAuth error:', errorParam)
          navigate('/login?error=oauth_failed')
          return
        }

        // Handle the OAuth callback - Supabase adds the session to the URL hash
        // First, let Supabase process the hash
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth error:', error)
          navigate('/login?error=auth_failed')
          return
        }

        if (session) {
          // Successfully authenticated - clear the hash and redirect
          window.history.replaceState(null, '', '/auth/callback')
          navigate('/dashboard', { replace: true })
        } else {
          // No session found - check if we have access_token in hash
          const accessToken = hashParams.get('access_token')
          
          if (!accessToken) {
            navigate('/login')
            return
          }
          
          // Wait for Supabase to process the token from hash
          // Supabase should automatically extract it from the URL hash
          const checkSession = async () => {
            const { data: { session: newSession }, error: sessionError } = await supabase.auth.getSession()
            if (newSession) {
              window.history.replaceState(null, '', '/auth/callback')
              navigate('/dashboard', { replace: true })
            } else if (sessionError) {
              console.error('Session error:', sessionError)
              navigate('/login?error=session_failed')
            } else {
              // Still no session, wait a bit more
              setTimeout(checkSession, 500)
            }
          }
          
          // Start checking for session
          setTimeout(checkSession, 100)
        }
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
