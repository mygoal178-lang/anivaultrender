import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Film,
  Tv,
  Users,
  Settings,
  Shield,
  Zap,
  LogOut,
  BarChart3,
  KeyRound,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Toast } from '../components/Toast';
import { AnimeCMS } from '../components/admin/AnimeCMS';
import { EpisodeManager } from '../components/admin/EpisodeManager';
import { AnivexaControlPanel } from '../components/admin/AnivexaControlPanel';
import { api } from '../services/api';

type AdminTab = 'overview' | 'anime' | 'episodes' | 'anivexa' | 'users' | 'settings';

interface AdminDashboardProps {
  navigate: (route: string) => void;
}

export function AdminDashboard({ navigate }: AdminDashboardProps) {
  const { user, isAdmin, isLoading, logout, showToast: authShowToast } = useAuth();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [episodeAnime, setEpisodeAnime] = useState<any | null>(null);

  // Password change
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');

  /** Adapter: components expect (title, message, variant) */
  const showToast = (
    title: string,
    message?: string,
    variant?: 'default' | 'destructive'
  ) => {
    const msg = message ? `${title}: ${message}` : title;
    const type =
      variant === 'destructive' ? 'error' : title.toLowerCase().includes('fail') ? 'error' : 'success';
    authShowToast(msg, type as 'success' | 'error' | 'info');
  };

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      navigate('/login');
    }
  }, [isLoading, isAdmin, navigate]);

  useEffect(() => {
    if (tab === 'overview' && isAdmin) {
      setStatsLoading(true);
      api
        .getAdminStats()
        .then(setStats)
        .catch((e) => showToast('Stats error', e.message, 'destructive'))
        .finally(() => setStatsLoading(false));
    }
    if (tab === 'users' && isAdmin) {
      setUsersLoading(true);
      api
        .getAdminUsers()
        .then((u) => setUsers(Array.isArray(u) ? u : []))
        .catch((e) => showToast('Users error', e.message, 'destructive'))
        .finally(() => setUsersLoading(false));
    }
  }, [tab, isAdmin]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    setPwSaving(true);
    try {
      await api.changeAdminPassword(oldPassword, newPassword);
      showToast('Password updated', 'Your admin password was changed.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err.message || 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-rose-500" />
        <h1 className="mt-4 text-xl font-bold text-white">Admin access required</h1>
        <p className="mt-2 text-sm text-slate-400">Sign in with an admin account to continue.</p>
        <button
          onClick={() => navigate('/login')}
          className="mt-6 rounded-full bg-rose-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-rose-500"
        >
          Go to Login
        </button>
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'anime', label: 'Anime CMS', icon: <Film className="h-4 w-4" /> },
    { id: 'episodes', label: 'Episodes', icon: <Tv className="h-4 w-4" /> },
    { id: 'anivexa', label: 'Anivexa API', icon: <Zap className="h-4 w-4" /> },
    { id: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6">
      <Toast />

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-white">
            <Shield className="h-6 w-6 text-rose-500" />
            Admin CMS
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Signed in as <span className="font-semibold text-slate-200">{user?.email || user?.name}</span>
          </p>
        </div>
        <button
          onClick={() => {
            logout();
            navigate('/');
          }}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"
        >
          <LogOut className="h-3.5 w-3.5" />
          Logout
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              if (t.id !== 'episodes') setEpisodeAnime(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all ${
              tab === t.id
                ? t.id === 'anivexa'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'bg-rose-600 text-white shadow-lg shadow-rose-600/25'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Anime', value: stats?.total_anime ?? stats?.totalAnime, icon: Film },
              { label: 'Episodes', value: stats?.total_episodes ?? stats?.totalEpisodes, icon: Tv },
              { label: 'Users', value: stats?.total_users ?? stats?.totalUsers, icon: Users },
              { label: 'Views', value: stats?.total_views ?? stats?.totalViews, icon: BarChart3 },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-white/10 bg-[#0a0a14] p-5 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {card.label}
                  </span>
                  <card.icon className="h-4 w-4 text-rose-500/80" />
                </div>
                <div className="mt-2 text-3xl font-black text-white">
                  {statsLoading ? '…' : card.value ?? '—'}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/40 to-[#0a0a14] p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <Zap className="h-4 w-4 text-indigo-400" />
              Anivexa API — full control
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Check which provider websites have working embeds, test stream URLs, pick sources, and
              import episodes into Supabase.
            </p>
            <button
              onClick={() => setTab('anivexa')}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
            >
              Open Anivexa Control Panel
            </button>
          </div>
        </div>
      )}

      {tab === 'anime' && (
        <AnimeCMS
          showToast={showToast}
          onManageEpisodesForAnime={(anime) => {
            setEpisodeAnime(anime);
            setTab('episodes');
          }}
        />
      )}

      {tab === 'episodes' && (
        <EpisodeManager
          initialSelectedAnime={episodeAnime}
          showToast={showToast}
          onSelectAnimeForCMS={() => setTab('anime')}
        />
      )}

      {tab === 'anivexa' && (
        <AnivexaControlPanel
          showToast={showToast}
          onImported={() => {
            /* optional refresh */
          }}
        />
      )}

      {tab === 'users' && (
        <div className="rounded-3xl border border-white/10 bg-[#0a0a14] p-5">
          <h2 className="mb-4 text-lg font-bold text-white">Users</h2>
          {usersLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase text-slate-500">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-white/5 text-slate-300">
                      <td className="px-3 py-2.5 font-medium text-white">{u.name || '—'}</td>
                      <td className="px-3 py-2.5">{u.email || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            u.role === 'admin'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-white/5 text-slate-400'
                          }`}
                        >
                          {u.role || 'user'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="max-w-lg space-y-4 rounded-3xl border border-white/10 bg-[#0a0a14] p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <KeyRound className="h-5 w-5 text-rose-500" />
            Change password
          </h2>
          <form onSubmit={handleChangePassword} className="space-y-3">
            {pwError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
                {pwError}
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
                Current password
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
                Confirm new password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white focus:border-rose-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={pwSaving}
              className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {pwSaving ? 'Saving…' : 'Update password'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
