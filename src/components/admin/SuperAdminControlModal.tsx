import React, { useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Clock,
  Crown,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { SUPER_ADMIN_EMAIL, useChillMate } from '../../context/ChillMateContext';
import { AccountStatus, AuthRegistrationSource } from '../../types';

interface SuperAdminControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  isStandalonePage?: boolean;
}

export const SuperAdminControlModal: React.FC<SuperAdminControlModalProps> = ({
  isOpen,
  onClose,
  isStandalonePage = false,
}) => {
  const {
    isSuperAdmin,
    registeredUsers,
    superAdminApproveUser,
    superAdminDeclineUser,
    superAdminToggleSuspendUser,
    superAdminDeleteUser,
  } = useChillMate();

  const [activeTab, setActiveTab] = useState<'PENDING' | 'ALL_USERS'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AccountStatus>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | AuthRegistrationSource>('ALL');

  if (!isOpen || !isSuperAdmin) return null;

  const pendingUsers = registeredUsers.filter((u) => u.accountStatus === 'PENDING');

  const filteredAllUsers = registeredUsers.filter((u) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (statusFilter !== 'ALL' && u.accountStatus !== statusFilter) return false;
    if (sourceFilter !== 'ALL' && u.authSource !== sourceFilter) return false;
    return true;
  });

  const panelContent = (
    <div className="w-full max-w-4xl rounded-3xl bg-zinc-950 border border-amber-500/30 p-6 sm:p-8 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800/90">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold">
              <span>SUPER ADMIN CONTROL PANEL</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">{SUPER_ADMIN_EMAIL}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-zinc-100">
              User Approval Gate & Account Access Control
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition-colors"
        >
          <X className="w-4 h-4" />
          <span>{isStandalonePage ? 'Open Chill Mate App' : 'Close Panel'}</span>
        </button>
      </div>

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <div className="text-[11px] text-zinc-400">Pending Requests</div>
          <div className="text-xl font-bold font-mono-tabular text-amber-400 mt-0.5">
            {pendingUsers.length}
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <div className="text-[11px] text-zinc-400">Approved Users</div>
          <div className="text-xl font-bold font-mono-tabular text-emerald-400 mt-0.5">
            {registeredUsers.filter((u) => u.accountStatus === 'APPROVED').length}
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <div className="text-[11px] text-zinc-400">Suspended / Declined</div>
          <div className="text-xl font-bold font-mono-tabular text-rose-400 mt-0.5">
            {
              registeredUsers.filter(
                (u) => u.accountStatus === 'SUSPENDED' || u.accountStatus === 'DECLINED'
              ).length
            }
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <div className="text-[11px] text-zinc-400">Total Accounts</div>
          <div className="text-xl font-bold font-mono-tabular text-zinc-100 mt-0.5">
            {registeredUsers.length}
          </div>
        </div>
      </div>

      {/* Mode Tabs: Pending Requests vs All Users Control */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-zinc-900 border border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('PENDING')}
            className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'PENDING'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Requests ({pendingUsers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ALL_USERS')}
            className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'ALL_USERS'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>All Users Control ({registeredUsers.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PENDING REQUESTS */}
      {activeTab === 'PENDING' && (
        <div className="space-y-3">
          {pendingUsers.length === 0 ? (
            <div className="p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="text-sm font-semibold text-zinc-200">
                All Pending Registration Requests Reviewed
              </div>
              <p className="text-xs text-zinc-400">
                New sign-ups via Google or Email/Password will appear here in real time for your approval.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800 divide-y divide-zinc-800/80 overflow-hidden">
              {pendingUsers.map((user) => (
                <div
                  key={user.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-900/80 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center text-xs font-bold shrink-0">
                      {user.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-100 truncate">
                          {user.displayName}
                        </span>
                        <span aria-hidden="true" className="text-zinc-600">
                          ·
                        </span>
                        <span className="text-xs text-amber-400 font-medium">
                          PENDING APPROVAL
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 mt-0.5">
                        <span className="font-mono-tabular">{user.email}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Source: {user.authSource === 'GOOGLE' ? 'Google OAuth' : 'Email / Password'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => superAdminApproveUser(user.id)}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Approve Access</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => superAdminDeclineUser(user.id)}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-rose-600 border border-zinc-700 hover:border-rose-500 text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ALL USERS CONTROL */}
      {activeTab === 'ALL_USERS' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users by name, email, or ID..."
                className="w-full min-h-[42px] pl-9 pr-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | AccountStatus)}
              className="min-h-[42px] px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-200 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DECLINED">Declined</option>
            </select>

            <select
              value={sourceFilter}
              onChange={(e) =>
                setSourceFilter(e.target.value as 'ALL' | AuthRegistrationSource)
              }
              className="min-h-[42px] px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-200 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Sources (Google & Email)</option>
              <option value="GOOGLE">Google Sign-In</option>
              <option value="EMAIL">Email / Password</option>
            </select>
          </div>

          {/* Users Table */}
          <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800 divide-y divide-zinc-800/80 overflow-hidden">
            {filteredAllUsers.map((user) => {
              const isRootSuperAdmin =
                user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ||
                user.systemRole === 'SUPER_ADMIN';

              return (
                <div
                  key={user.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-900/80 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 border ${
                        isRootSuperAdmin
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-200'
                      }`}
                    >
                      {user.displayName.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-100 truncate">
                          {user.displayName}
                        </span>
                        <span aria-hidden="true" className="text-zinc-600">
                          ·
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            isRootSuperAdmin ? 'text-amber-400' : 'text-zinc-400'
                          }`}
                        >
                          {isRootSuperAdmin ? 'SUPER_ADMIN' : 'USER'}
                        </span>
                        <span aria-hidden="true" className="text-zinc-600">
                          ·
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            user.accountStatus === 'APPROVED'
                              ? 'text-emerald-400'
                              : user.accountStatus === 'PENDING'
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {user.accountStatus}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 mt-0.5">
                        <span className="font-mono-tabular inline-flex items-center gap-1">
                          <Mail className="w-3 h-3 text-zinc-500" />
                          {user.email}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Registered via{' '}
                          <strong className="text-zinc-200">
                            {user.authSource === 'GOOGLE' ? 'Google' : 'Email'}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Admin Controls */}
                  {isRootSuperAdmin ? (
                    <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Protected Super Admin</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {user.accountStatus !== 'APPROVED' && (
                        <button
                          type="button"
                          onClick={() => superAdminApproveUser(user.id)}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                      )}

                      {user.accountStatus === 'APPROVED' && (
                        <button
                          type="button"
                          onClick={() => superAdminToggleSuspendUser(user.id)}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-amber-600 border border-zinc-700 hover:border-amber-500 text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Suspend</span>
                        </button>
                      )}

                      {user.accountStatus === 'SUSPENDED' && (
                        <button
                          type="button"
                          onClick={() => superAdminToggleSuspendUser(user.id)}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Reactivate</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => superAdminDeleteUser(user.id)}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-rose-600 border border-zinc-700 hover:border-rose-500 text-xs font-semibold text-rose-400 hover:text-white flex items-center gap-1.5 transition-colors"
                        title="Permanently Delete User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  if (isStandalonePage) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4">
        {panelContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      {panelContent}
    </div>
  );
};
