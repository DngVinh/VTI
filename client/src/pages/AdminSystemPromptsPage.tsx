import React, { useEffect, useState } from 'react';
import { useSystemPrompts } from '../features/AdminSystemPrompt/hooks/useSystemPrompts';
import { usePromptMutations } from '../features/AdminSystemPrompt/hooks/usePromptMutations';
import { SystemPromptFilter } from '../features/AdminSystemPrompt/components/SystemPromptFilter';
import { SystemPromptList } from '../features/AdminSystemPrompt/components/SystemPromptList';
import { SystemPromptFormModal } from '../features/AdminSystemPrompt/components/SystemPromptFormModal';
import type { SystemPrompt, CreateSystemPromptDto, PromptType, PromptLanguage, PromptStatus } from '../features/AdminSystemPrompt/types';
import { AppShell } from '../layouts/AppShell';
import { useTranslation } from '../locales/I18nContext';

const AdminSystemPromptsPage: React.FC = () => {
  const { t } = useTranslation();
  const { prompts, loading, error: fetchError, fetchPrompts } = useSystemPrompts();
  const { createDraft, publishPrompt, rollbackPrompt, isMutating, error: mutationError } = usePromptMutations();

  const [filters, setFilters] = useState<{
    type?: PromptType | '';
    language?: PromptLanguage | '';
    status?: PromptStatus | '';
  }>({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);

  useEffect(() => {
    fetchPrompts({
      type: filters.type || undefined,
      language: filters.language || undefined,
      status: filters.status || undefined,
    });
  }, [fetchPrompts, filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleOpenCreateModal = () => {
    setEditingPrompt(null);
    setIsModalOpen(true);
  };

  const handleViewPrompt = (prompt: SystemPrompt) => {
    setEditingPrompt(prompt);
    setIsModalOpen(true);
  };

  const getCleanFilters = () => {
    return {
      type: filters.type || undefined,
      language: filters.language || undefined,
      status: filters.status || undefined,
    };
  };

  const handlePublish = async (id: string) => {
    if (!window.confirm('Are you sure you want to publish this prompt version? It will become the active version.')) {
      return;
    }
    const result = await publishPrompt(id);
    if (result) {
      fetchPrompts(getCleanFilters());
    }
  };

  const handleRollback = async (id: string) => {
    if (!window.confirm('Are you sure you want to rollback to this previous version? A new draft will be created from it.')) {
      return;
    }
    const result = await rollbackPrompt(id);
    if (result) {
      fetchPrompts(getCleanFilters());
    }
  };

  const handleModalSubmit = async (data: CreateSystemPromptDto) => {
    const result = await createDraft(data);
    if (result) {
      setIsModalOpen(false);
      fetchPrompts(getCleanFilters());
    }
  };

  return (
    <AppShell>
      <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
              AI Prompt Engineering
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
              {t('admin.promptsTitle', 'System Prompts Management')}
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              {t('admin.promptsSubtitle', 'Quản lý, tạo phiên bản và triển khai mẫu chỉ thị AI cho toàn hệ thống.')}
            </p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-xs"
          >
            <span>{t('admin.createPrompt', '+ Tạo bản nháp Prompt mới')}</span>
          </button>
        </div>

        {(fetchError || mutationError) && (
          <div className="bg-red-50 border border-red-200 p-4 mb-6 rounded-2xl">
            <p className="text-red-700 font-medium text-sm">Error: {fetchError || mutationError}</p>
          </div>
        )}

        <div className="space-y-6">
          <SystemPromptFilter filters={filters} onFilterChange={handleFilterChange} />

          <SystemPromptList
            prompts={prompts}
            loading={loading}
            onViewPrompt={handleViewPrompt}
            onPublishPrompt={handlePublish}
            onRollbackPrompt={handleRollback}
          />
        </div>

        <SystemPromptFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleModalSubmit}
          initialData={editingPrompt}
          isSubmitting={isMutating}
        />
      </div>
    </AppShell>
  );
};

export default AdminSystemPromptsPage;
