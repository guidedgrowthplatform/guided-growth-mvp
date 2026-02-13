// Custom Google OAuth client (replaces Supabase auth)

export interface User {
  email: string;
  name: string;
  picture: string;
  id: string;
}

export async function signInWithGoogle() {
  // Redirect to our custom OAuth endpoint
  const apiUrl = import.meta.env.DEV
    ? 'http://localhost:5173/api/auth/google'
    : 'https://guided-growth-mvp.vercel.app/api/auth/google';
  
  window.location.href = apiUrl;
}

export async function getSession(token: string): Promise<User | null> {
  try {
    const apiUrl = import.meta.env.DEV
      ? 'http://localhost:5173/api/auth/session'
      : 'https://guided-growth-mvp.vercel.app/api/auth/session';
    
    const response = await fetch(`${apiUrl}?token=${token}`);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data.user;
  } catch (error) {
    console.error('Session error:', error);
    return null;
  }
}

export function getStoredSession(): User | null {
  const token = localStorage.getItem('auth_token');
  if (!token) return null;
  
  try {
    const sessionData = JSON.parse(atob(token));
    // Check expiration
    if (sessionData.exp && sessionData.exp < Math.floor(Date.now() / 1000)) {
      localStorage.removeItem('auth_token');
      return null;
    }
    return {
      email: sessionData.email,
      name: sessionData.name,
      picture: sessionData.picture,
      id: sessionData.sub,
    };
  } catch {
    localStorage.removeItem('auth_token');
    return null;
  }
}

export function storeSession(token: string) {
  localStorage.setItem('auth_token', token);
}

export function signOut() {
  localStorage.removeItem('auth_token');
  window.location.href = '/login';
}
