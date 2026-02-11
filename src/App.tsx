import { Routes, Route } from 'react-router-dom'
import './App.css'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Dashboard from './pages/Dashboard'
import RootRedirect from './pages/RootRedirect'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/" element={<RootRedirect />} />
    </Routes>
  )
}

export default App
