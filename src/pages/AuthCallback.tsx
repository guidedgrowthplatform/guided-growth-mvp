import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Handle the OAuth callback - Supabase adds the session to the URL hash
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth error:', error)
          navigate('/login?error=auth_failed')
          return
        }

        if (session) {
          // Successfully authenticated
          navigate('/dashboard') // or wherever you want to redirect
        } else {
          // No session found - try to get it from the URL hash
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          const accessToken = hashParams.get('access_token')
          const errorParam = hashParams.get('error')
          
          if (errorParam) {
            console.error('OAuth error:', errorParam)
            navigate('/login?error=oauth_failed')
            return
          }
          
          if (!accessToken) {
            navigate('/login')
            return
          }
          
          // Wait a bit for Supabase to process the token
          setTimeout(async () => {
            const { data: { session: newSession } } = await supabase.auth.getSession()
            if (newSession) {
              navigate('/dashboard')
            } else {
              navigate('/login')
            }
          }, 1000)
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
