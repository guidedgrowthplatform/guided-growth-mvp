/**
 * API utility for making requests to the backend
 * Uses VITE_API_URL environment variable in production
 * Falls back to relative URLs (proxied by Vite in development)
 */

const getApiUrl = () => {
  // In production, use VITE_API_URL if set
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  // In development, use relative URLs (proxied by Vite)
  return ''
}

/**
 * Make an authenticated API request
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${getApiUrl()}${endpoint}`
  
  const defaultOptions = {
    credentials: 'include', // Include cookies for session
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  }

  const response = await fetch(url, {
    ...defaultOptions,
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser() {
  try {
    return await apiRequest('/auth/me')
  } catch (error) {
    return null
  }
}

/**
 * Initiate Google OAuth login
 */
export function initiateGoogleLogin() {
  const apiUrl = getApiUrl()
  window.location.href = `${apiUrl}/auth/google`
}

/**
 * Logout current user
 */
export async function logout() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' })
    // Redirect to home or login page
    window.location.href = '/'
  } catch (error) {
    console.error('Logout failed:', error)
  }
}

