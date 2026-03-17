import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as adminApi from '@/api/admin';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { queryKeys } from '@/lib/query';
import { allowlistSchema, type AllowlistForm } from '@/lib/validation';

export function AdminPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'users' | 'allowlist' | 'audit'>('users');
  const isAdmin = user?.role === 'admin';

  const usersQuery = useQuery({
    queryKey: queryKeys.admin.users,
    queryFn: adminApi.fetchUsers,
    enabled: isAdmin,
  });

  const allowlistQuery = useQuery({
    queryKey: queryKeys.admin.allowlist,
    queryFn: adminApi.fetchAllowlist,
    enabled: isAdmin,
  });

  const auditLogQuery = useQuery({
    queryKey: queryKeys.admin.auditLog,
    queryFn: () => adminApi.fetchAuditLog(),
    enabled: isAdmin,
  });

  const users = usersQuery.data ?? [];
  const allowlist = allowlistQuery.data ?? [];
  const auditLog = auditLogQuery.data ?? [];
  const loading = usersQuery.isLoading || allowlistQuery.isLoading || auditLogQuery.isLoading;

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      adminApi.updateUserRole(userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.admin.users }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      adminApi.updateUserStatus(userId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.admin.users }),
  });

  const addAllowlistMutation = useMutation({
    mutationFn: ({ email, note }: { email: string; note: string }) =>
      adminApi.addToAllowlist(email, note),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.allowlist });
      addToast('success', `Added ${variables.email} to allowlist`);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      addToast('error', err.message || 'Failed to add email');
    },
  });

  const removeAllowlistMutation = useMutation({
    mutationFn: (id: string) => adminApi.removeFromAllowlist(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.allowlist });
      addToast('info', 'Removed from allowlist');
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AllowlistForm>({
    resolver: zodResolver(allowlistSchema),
    defaultValues: { email: '', note: '' },
  });

  const onAddAllowlist = (data: AllowlistForm) => {
    addAllowlistMutation.mutate({ email: data.email, note: data.note ?? '' });
    reset();
  };

  if (!isAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-danger">Access Denied</h1>
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
      <h1 className="mb-6 text-2xl font-bold text-primary sm:text-3xl">Admin Panel</h1>

      {/* Tabs */}
      <div className="mb-6 flex space-x-1 overflow-x-auto border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'border-b-2 border-primary bg-surface-secondary text-primary'
                : 'text-content-secondary hover:text-content'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-elevated">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-content">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-content">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-content">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-content">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-content">
                    Last Login
                  </th>
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
                        onChange={(e) =>
                          updateRoleMutation.mutate({ userId: u.id, role: e.target.value })
                        }
                        className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.status}
                        onChange={(e) =>
                          updateStatusMutation.mutate({ userId: u.id, status: e.target.value })
                        }
                        className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
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
          <form
            onSubmit={handleSubmit(onAddAllowlist)}
            className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-elevated"
          >
            <h3 className="mb-3 font-semibold text-content">Add Email</h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                {...register('email')}
                placeholder="email@example.com"
                error={errors.email?.message}
              />
              <Input {...register('note')} placeholder="Note (optional)" />
              <Button type="submit" className="flex-shrink-0">
                Add
              </Button>
            </div>
          </form>

          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-elevated">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-border bg-surface-secondary">
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
                      <td className="px-4 py-3 text-sm">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => removeAllowlistMutation.mutate(entry.id)}
                        >
                          Remove
                        </Button>
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
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-elevated">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
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
                    <td className="px-4 py-3 text-sm">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm">{log.admin_email}</td>
                    <td className="px-4 py-3 text-sm">{log.action}</td>
                    <td className="px-4 py-3 text-sm">
                      {log.target_type}: {log.target_identifier}
                    </td>
                    <td className="px-4 py-3 text-sm">
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
  );
}
