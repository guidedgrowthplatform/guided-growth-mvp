import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const { error: authError } = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password);

    setLoading(false);

    if (authError) {
      setError(authError);
    } else if (isSignUp) {
      setSuccess('Account created! You can now sign in.');
      setIsSignUp(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100">
      <div className="glass rounded-2xl shadow-2xl border border-cyan-200/50 p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2"
              style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Guided Growth
          </h1>
          <p className="text-slate-600">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-cyan-200 bg-white/70 
                         focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent
                         transition-all duration-200"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-xl border border-cyan-200 bg-white/70 
                         focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent
                         transition-all duration-200"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-600 text-sm">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-semibold text-white
                       bg-gradient-to-r from-cyan-500 to-blue-500 
                       hover:from-cyan-600 hover:to-blue-600
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200 shadow-lg shadow-cyan-500/25
                       hover:shadow-cyan-500/40"
          >
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(null); setSuccess(null); }}
            className="text-sm text-cyan-600 hover:text-cyan-700 transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}
