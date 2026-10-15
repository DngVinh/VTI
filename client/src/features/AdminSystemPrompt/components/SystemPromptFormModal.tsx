import React, { useState, useEffect } from 'react';
import type { SystemPrompt, CreateSystemPromptDto, PromptType, PromptLanguage } from '../types';

interface SystemPromptFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateSystemPromptDto) => void;
  initialData: SystemPrompt | null;
  isSubmitting: boolean;
}

export const SystemPromptFormModal: React.FC<SystemPromptFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isSubmitting
}) => {
  const [formData, setFormData] = useState<CreateSystemPromptDto>({
    promptKey: '',
    type: 'GENERATION',
    language: 'EN',
    content: ''
  });

  useEffect(() => {
     
    if (initialData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        promptKey: initialData.promptKey,
        type: initialData.type,
        language: initialData.language,
        content: initialData.content
      });
    } else {
       
      setFormData({
        promptKey: '',
        type: 'GENERATION',
        language: 'EN',
        content: ''
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">
            {initialData ? `Edit Prompt: ${initialData.promptKey} (v${initialData.version})` : 'Create New Draft'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Đóng modal"
            className="text-gray-400 hover:text-gray-600 font-bold text-xl"
          >
            &times;
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form id="prompt-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col">
                <label htmlFor="promptKey" className="text-sm font-medium text-gray-700 mb-1">Prompt Key *</label>
                <input
                  id="promptKey"
                  aria-label="Prompt Key"
                  type="text"
                  required
                  readOnly={!!initialData}
                  value={formData.promptKey}
                  onChange={(e) => setFormData({...formData, promptKey: e.target.value})}
                  className={`border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${initialData ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                  placeholder="e.g. DEFAULT_GENERATION_PROMPT"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  required
                  disabled={!!initialData}
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value as PromptType})}
                  className={`border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${initialData ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                >
                  <option value="GENERATION">GENERATION</option>
                  <option value="EVALUATION">EVALUATION</option>
                  <option value="LEARNING_PATH">LEARNING_PATH</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Language *</label>
                <select
                  required
                  disabled={!!initialData}
                  value={formData.language}
                  onChange={(e) => setFormData({...formData, language: e.target.value as PromptLanguage})}
                  className={`border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${initialData ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                >
                  <option value="EN">English (EN)</option>
                  <option value="VI">Vietnamese (VI)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col h-96">
              <label className="text-sm font-medium text-gray-700 mb-1 flex justify-between">
                <span>Content (Prompt Template) *</span>
                <span className="text-xs text-gray-500">Use {'{{variable}}'} for dynamic data</span>
              </label>
              <textarea
                required
                value={formData.content}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                className="w-full h-full p-4 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                placeholder="Enter prompt content here..."
              ></textarea>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="prompt-form"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 transition-colors shadow-sm"
          >
            {isSubmitting ? 'Saving Draft...' : 'Save Draft'}
          </button>
        </div>
      </div>
    </div>
  );
};
