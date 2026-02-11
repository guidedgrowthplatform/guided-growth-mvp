import './App.css'
import { signInWithGoogle } from './lib/supabase'

function App() {
  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      console.error('Error signing in with Google', error)
      alert('There was a problem signing in. Please try again.')
    }
  }

  return (
    <div className="card">
      <h1>Guided Growth</h1>
      <p>Sign in to continue</p>
      <button onClick={handleGoogleSignIn}>
        Continue with Google
      </button>
    </div>
  )
}

export default App
