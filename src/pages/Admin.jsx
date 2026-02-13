import { useState, useEffect } from 'react'
import { useUser } from '../contexts'

export default function Admin() {
  const { currentUser } = useUser()
  const [users, setUsers] = useState([])
  const [allowlist, setAllowlist] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [activeTab, setActiveTab] = useState('users')
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [newEmailNote, setNewEmailNote] = useState('')

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      return
    }
    fetchData()
  }, [currentUser])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [usersRes, allowlistRes, auditRes] = await Promise.all([
        fetch('/api/admin/users', { credentials: 'include' }),
        fetch('/api/admin/allowlist', { credentials: 'include' }),
        fetch('/api/admin/audit-log?limit=50', { credentials: 'include' })
      ])

      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(usersData)
      }

      if (allowlistRes.ok) {
        const allowlistData = await allowlistRes.json()
        setAllowlist(allowlistData)
      }

      if (auditRes.ok) {
        const auditData = await auditRes.json()
        setAuditLog(auditData)
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateUserRole = async (userId, newRole) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole })
      })

      if (res.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Failed to update role:', error)
    }
  }

  const updateUserStatus = async (userId, newStatus) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      })

      if (res.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const addToAllowlist = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/admin/allowlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: newEmail, note: newEmailNote })
      })

      if (res.ok) {
        setNewEmail('')
        setNewEmailNote('')
        fetchData()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to add email')
      }
    } catch (error) {
      console.error('Failed to add to allowlist:', error)
      alert('Failed to add email')
    }
  }

  const removeFromAllowlist = async (id) => {
    if (!confirm('Remove this email from allowlist?')) return

    try {
      const res = await fetch(`/api/admin/allowlist/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (res.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Failed to remove from allowlist:', error)
    }
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p>Admin access required</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 ${activeTab === 'users' ? 'border-b-2 border-blue-500' : ''}`}
        >
          Users
        </button>
        <button
          onClick={() => setActiveTab('allowlist')}
          className={`px-4 py-2 ${activeTab === 'allowlist' ? 'border-b-2 border-blue-500' : ''}`}
        >
          Allowlist
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 ${activeTab === 'audit' ? 'border-b-2 border-blue-500' : ''}`}
        >
          Audit Log
        </button>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Users ({users.length})</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr>
                  <th className="px-4 py-2 border">Email</th>
                  <th className="px-4 py-2 border">Name</th>
                  <th className="px-4 py-2 border">Role</th>
                  <th className="px-4 py-2 border">Status</th>
                  <th className="px-4 py-2 border">Last Login</th>
                  <th className="px-4 py-2 border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td className="px-4 py-2 border">{user.email}</td>
                    <td className="px-4 py-2 border">{user.name || '-'}</td>
                    <td className="px-4 py-2 border">
                      <select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.id, e.target.value)}
                        className="border rounded px-2 py-1"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 border">
                      <select
                        value={user.status}
                        onChange={(e) => updateUserStatus(user.id, e.target.value)}
                        className="border rounded px-2 py-1"
                      >
                        <option value="active">Active</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 border">
                      {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-2 border">
                      <a
                        href={`/api/admin/users/${user.id}/data`}
                        target="_blank"
                        className="text-blue-500 hover:underline"
                      >
                        View Data
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Allowlist Tab */}
      {activeTab === 'allowlist' && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Allowlist ({allowlist.length})</h2>
          
          <form onSubmit={addToAllowlist} className="mb-6 p-4 bg-gray-50 rounded">
            <h3 className="font-semibold mb-2">Add Email</h3>
            <div className="flex gap-2 mb-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
                required
                className="flex-1 border rounded px-3 py-2"
              />
              <input
                type="text"
                value={newEmailNote}
                onChange={(e) => setNewEmailNote(e.target.value)}
                placeholder="Note (optional)"
                className="flex-1 border rounded px-3 py-2"
              />
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Add
              </button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr>
                  <th className="px-4 py-2 border">Email</th>
                  <th className="px-4 py-2 border">Note</th>
                  <th className="px-4 py-2 border">Added By</th>
                  <th className="px-4 py-2 border">Created</th>
                  <th className="px-4 py-2 border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allowlist.map(entry => (
                  <tr key={entry.id}>
                    <td className="px-4 py-2 border">{entry.email}</td>
                    <td className="px-4 py-2 border">{entry.note || '-'}</td>
                    <td className="px-4 py-2 border">{entry.added_by_email || 'System'}</td>
                    <td className="px-4 py-2 border">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 border">
                      <button
                        onClick={() => removeFromAllowlist(entry.id)}
                        className="text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Audit Log</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr>
                  <th className="px-4 py-2 border">Time</th>
                  <th className="px-4 py-2 border">Admin</th>
                  <th className="px-4 py-2 border">Action</th>
                  <th className="px-4 py-2 border">Target</th>
                  <th className="px-4 py-2 border">Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map(log => (
                  <tr key={log.id}>
                    <td className="px-4 py-2 border">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 border">{log.admin_email}</td>
                    <td className="px-4 py-2 border">{log.action}</td>
                    <td className="px-4 py-2 border">
                      {log.target_type}: {log.target_identifier}
                    </td>
                    <td className="px-4 py-2 border">
                      {log.payload_json ? JSON.stringify(log.payload_json) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

