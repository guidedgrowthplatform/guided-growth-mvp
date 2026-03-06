import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import * as adminApi from '@/api/admin';
import type { User, AllowlistEntry, AuditLogEntry } from '@shared/types';

export function AdminPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'allowlist' | 'audit'>('users');
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newEmailNote, setNewEmailNote] = useState('');

  const fetchedRef = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    if (fetchedRef[0]) return;
    fetchedRef[1](true);
    fetchData();
  }, [user?.role]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [u, a, l] = await Promise.all([
        adminApi.fetchUsers(),
        adminApi.fetchAllowlist(),
        adminApi.fetchAuditLog(),
      ]);
      setUsers(u);
      setAllowlist(a);
      setAuditLog(l);
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    await adminApi.updateUserRole(userId, role);
    fetchData();
  };

  const handleUpdateStatus = async (userId: string, status: string) => {
    await adminApi.updateUserStatus(userId, status);
    fetchData();
  };

  const handleAddToAllowlist = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminApi.addToAllowlist(newEmail, newEmailNote);
      setNewEmail('');
      setNewEmailNote('');
      addToast('success', `Added ${newEmail} to allowlist`);
      fetchData();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to add email');
    }
  };

  const handleRemoveFromAllowlist = async (id: string) => {
    await adminApi.removeFromAllowlist(id);
    addToast('info', 'Removed from allowlist');
    fetchData();
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-slate-600">Admin access required</p>
        </div>
      </div>
    );
  }

  if (loading) return <LoadingSpinner className="h-64" />;

  const tabs = [
    { key: 'users' as const, label: `Users (${users.length})` },
    { key: 'allowlist' as const, label: `Allowlist (${allowlist.length})` },
    { key: 'audit' as const, label: 'Audit Log' },
  ];

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent mb-6">
        Admin Panel
      </h1>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6 border-b border-cyan-200/50 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-all rounded-t-lg ${
              activeTab === tab.key
                ? 'bg-gradient-to-r from-cyan-400/20 to-blue-400/20 text-cyan-700 border-b-2 border-cyan-500'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="glass rounded-2xl shadow-xl border border-cyan-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-cyan-100/50 border-b border-cyan-300/50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-800">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-800">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-800">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-800">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-800">Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-200/30">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-cyan-50/30">
                    <td className="px-4 py-3 text-sm">{u.email}</td>
                    <td className="px-4 py-3 text-sm">{u.name || '-'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                        className="text-sm border border-cyan-300/50 rounded-lg px-2 py-1 bg-white/80"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.status}
                        onChange={(e) => handleUpdateStatus(u.id, e.target.value)}
                        className="text-sm border border-cyan-300/50 rounded-lg px-2 py-1 bg-white/80"
                      >
                        <option value="active">Active</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
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
          <form onSubmit={handleAddToAllowlist} className="glass rounded-2xl shadow-xl border border-cyan-200/50 p-4 mb-6">
            <h3 className="font-semibold mb-3 text-slate-800">Add Email</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@example.com" required />
              <Input value={newEmailNote} onChange={(e) => setNewEmailNote(e.target.value)} placeholder="Note (optional)" />
              <Button type="submit" className="flex-shrink-0">Add</Button>
            </div>
          </form>

          <div className="glass rounded-2xl shadow-xl border border-cyan-200/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-cyan-100/50 border-b border-cyan-300/50">
                    <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Note</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Added By</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Created</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-200/30">
                  {allowlist.map((entry) => (
                    <tr key={entry.id} className="hover:bg-cyan-50/30">
                      <td className="px-4 py-3 text-sm">{entry.email}</td>
                      <td className="px-4 py-3 text-sm">{entry.note || '-'}</td>
                      <td className="px-4 py-3 text-sm">{entry.added_by_email || 'System'}</td>
                      <td className="px-4 py-3 text-sm">{new Date(entry.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="danger" onClick={() => handleRemoveFromAllowlist(entry.id)}>Remove</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <div className="glass rounded-2xl shadow-xl border border-cyan-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-cyan-100/50 border-b border-cyan-300/50">
                  <th className="px-4 py-3 text-left text-sm font-semibold">Time</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Admin</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Action</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Target</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-200/30">
                {auditLog.map((log) => (
                  <tr key={log.id} className="hover:bg-cyan-50/30">
                    <td className="px-4 py-3 text-sm">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">{log.admin_email}</td>
                    <td className="px-4 py-3 text-sm">{log.action}</td>
                    <td className="px-4 py-3 text-sm">{log.target_type}: {log.target_identifier}</td>
                    <td className="px-4 py-3 text-sm">{log.payload_json ? JSON.stringify(log.payload_json) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
