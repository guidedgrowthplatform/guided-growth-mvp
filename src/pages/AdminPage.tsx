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
          <h1 className="text-2xl font-bold text-danger mb-4">Access Denied</h1>
          <p className="text-content-secondary">Admin access required</p>
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
      <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-6">
        Admin Panel
      </h1>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-all rounded-t-lg ${
              activeTab === tab.key
                ? 'bg-surface-secondary text-primary border-b-2 border-primary'
                : 'text-content-secondary hover:text-content'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-surface shadow-elevated border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-surface-secondary border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-content">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-content">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-content">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-content">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-content">Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-secondary">
                    <td className="px-4 py-3 text-sm">{u.email}</td>
                    <td className="px-4 py-3 text-sm">{u.name || '-'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                        className="text-sm border border-border rounded-lg px-2 py-1 bg-surface"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.status}
                        onChange={(e) => handleUpdateStatus(u.id, e.target.value)}
                        className="text-sm border border-border rounded-lg px-2 py-1 bg-surface"
                      >
                        <option value="active">Active</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-content-secondary">
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
          <form onSubmit={handleAddToAllowlist} className="bg-surface shadow-elevated border border-border rounded-2xl p-4 mb-6">
            <h3 className="font-semibold mb-3 text-content">Add Email</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@example.com" required />
              <Input value={newEmailNote} onChange={(e) => setNewEmailNote(e.target.value)} placeholder="Note (optional)" />
              <Button type="submit" className="flex-shrink-0">Add</Button>
            </div>
          </form>

          <div className="bg-surface shadow-elevated border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-surface-secondary border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Note</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Added By</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Created</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allowlist.map((entry) => (
                    <tr key={entry.id} className="hover:bg-surface-secondary">
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
        <div className="bg-surface shadow-elevated border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-surface-secondary border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-semibold">Time</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Admin</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Action</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Target</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {auditLog.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-secondary">
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
