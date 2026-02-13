import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import KpiConfig from './pages/KpiConfig'
import Capture from './pages/Capture'
import Report from './pages/Report'
import Admin from './pages/Admin'
import { initializeSampleData } from './utils/storage'

// Initialize sample data on first load
initializeSampleData()

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Capture />} />
          <Route path="/configure" element={<KpiConfig />} />
          <Route path="/capture" element={<Capture />} />
          <Route path="/report" element={<Report />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
