import { useState } from 'react';
import {
  AdminUserFilters,
  AdminUserTable,
  ConfirmActionModal,
  useAdminUsers
} from '../features/AdminUserManagement';

import type {
  AdminUser,
  UserAction
} from '../features/AdminUserManagement';
import { AppShell } from '../layouts/AppShell';
import { useTranslation } from '../locales/I18nContext';

export const AdminUsersPage = () => {
  const { t } = useTranslation();
  const {
    users,
    pagination,
    search,
    status,
    isLoading,
    actionLoadingId,
    error,
    successMessage,
    handleSearchChange,
    handleStatusChange,
    handlePageChange,
    handleUserAction
  } = useAdminUsers();

  const [selectedUser, setSelectedUser] =
    useState<AdminUser | null>(null);

  const [selectedAction, setSelectedAction] =
    useState<UserAction | null>(null);

  const handleRequestAction = (
    user: AdminUser,
    action: UserAction
  ) => {
    setSelectedUser(user);
    setSelectedAction(action);
  };

  const handleConfirmAction = async () => {
    if (!selectedUser || !selectedAction) {
      return;
    }

    await handleUserAction(
      selectedUser,
      selectedAction
    );

    setSelectedUser(null);
    setSelectedAction(null);
  };

  const handleCancelAction = () => {
    if (actionLoadingId) {
      return;
    }

    setSelectedUser(null);
    setSelectedAction(null);
  };

  return (
    <AppShell>
      <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
            Admin Console
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {t('admin.usersTitle', 'Quản lý người dùng')}
          </h1>

          <p className="mt-2 max-w-2xl text-slate-600 text-sm">
            {t('admin.usersSubtitle', 'Tìm kiếm, xem thông tin và phân quyền tài khoản người dùng trong hệ thống.')}
          </p>
        </div>

        {/* Main card */}
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
          {/* Card header */}
          <div className="border-b border-slate-100 p-6">
            <AdminUserFilters
              search={search}
              status={status}
              onSearchChange={handleSearchChange}
              onStatusChange={handleStatusChange}
            />
          </div>

          {/* Feedback */}
          <div className="px-6 pt-6">
            {successMessage && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                {successMessage}
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="p-6">
            <AdminUserTable
              users={users}
              isLoading={isLoading}
              actionLoadingId={actionLoadingId}
              onLock={(user) =>
                handleRequestAction(user, 'LOCK')
              }
              onUnlock={(user) =>
                handleRequestAction(user, 'UNLOCK')
              }
            />
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-4 border-t border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-500">
              {t('admin.page', 'Trang')}{' '}
              <span className="font-bold text-slate-700">
                {pagination.page}
              </span>{' '}
              /{' '}
              <span className="font-bold text-slate-700">
                {pagination.totalPages}
              </span>{' '}
              ({pagination.total} {t('admin.usersCount', 'người dùng')})
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={
                  pagination.page <= 1 ||
                  isLoading
                }
                onClick={() =>
                  handlePageChange(
                    pagination.page - 1
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('admin.prev', 'Trước')}
              </button>

              <div className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-indigo-600 px-3 text-sm font-bold text-white">
                {pagination.page}
              </div>

              <button
                type="button"
                disabled={
                  pagination.page >=
                    pagination.totalPages ||
                  isLoading
                }
                onClick={() =>
                  handlePageChange(
                    pagination.page + 1
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('admin.next', 'Sau')}
              </button>
            </div>
          </div>
        </section>

        {/* Confirmation modal */}
        <ConfirmActionModal
          user={selectedUser}
          action={selectedAction}
          isLoading={
            selectedUser
              ? actionLoadingId ===
                selectedUser._id
              : false
          }
          onConfirm={handleConfirmAction}
          onCancel={handleCancelAction}
        />
      </div>
    </AppShell>
  );
};