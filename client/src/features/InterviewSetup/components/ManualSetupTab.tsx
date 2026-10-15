import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import type { BaseEntity } from '../../../services/api/interviewApi';
import type { ManualSetupFormData } from '../types';
import { useTranslation } from '../../../locales/I18nContext';

interface ManualSetupTabProps {
  isLoading: boolean;
  roles: BaseEntity[];
  levels: BaseEntity[];
  technologies: BaseEntity[];
  onSubmit: (data: ManualSetupFormData) => void;
}

const LEVEL_RANK: Record<string, number> = {
  FRESHER: 1,
  INTERN: 1,
  JUNIOR: 2,
  MIDDLE: 3,
  MID: 3,
  SENIOR: 4,
  LEAD: 5,
  MANAGER: 6,
  DIRECTOR: 6,
};

export const ManualSetupTab: React.FC<ManualSetupTabProps> = ({
  isLoading,
  roles,
  levels,
  technologies,
  onSubmit,
}) => {
  const form = useFormContext<ManualSetupFormData>();
  const { t } = useTranslation();

  const sortedLevels = React.useMemo(() => {
    if (!levels) return [];
    return [...levels].sort((a, b) => {
      const keyA = (a.code || a.name || '').toUpperCase();
      const keyB = (b.code || b.name || '').toUpperCase();
      const rankA = Object.entries(LEVEL_RANK).find(([k]) => keyA.includes(k))?.[1] ?? 99;
      const rankB = Object.entries(LEVEL_RANK).find(([k]) => keyB.includes(k))?.[1] ?? 99;
      return rankA - rankB;
    });
  }, [levels]);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 animate-in fade-in duration-300">
      
      {/* Job Position (Role) */}
      <div className="group">
        <label htmlFor="jobPosition" className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
          {t('setup.jobRole', 'Chức danh ứng tuyển')}
        </label>
        <div className="relative">
          <select
            id="jobPosition"
            {...form.register('jobPosition', { required: t('setup.requiredRole', 'Vui lòng chọn chức danh') })}
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 hover:bg-slate-100/60 focus:bg-white text-slate-700 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm outline-none appearance-none cursor-pointer"
            disabled={isLoading}
          >
            <option value="" disabled className="text-slate-500">{t('setup.selectRolePlaceholder', '-- Click để chọn chức danh của bạn --')}</option>
            {roles?.map((role) => (
              <option key={role._id} value={role._id}>
                {role.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 group-hover:text-indigo-500 transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
          </div>
        </div>
        {form.formState.errors.jobPosition && (
          <p className="mt-1.5 text-xs text-red-500 font-medium flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-red-500"></span> {form.formState.errors.jobPosition.message}
          </p>
        )}
      </div>

      {/* Level */}
      <div>
        <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">
          {t('setup.experienceLevel', 'Trình độ chuyên môn')}
        </label>
        <Controller
          name="level"
          control={form.control}
          rules={{ required: t('setup.requiredLevel', 'Vui lòng chọn cấp độ') }}
          render={({ field }) => (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {sortedLevels?.length > 0 ? sortedLevels.map((level) => {
                const isSelected = field.value === level._id;
                return (
                  <label 
                    key={level._id} 
                    className={`relative flex items-center justify-center p-3 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                      isSelected 
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-[0_0_0_3px_rgba(79,70,229,0.1)]' 
                        : 'border-slate-100 bg-white hover:border-indigo-300 hover:bg-slate-50 shadow-sm'
                    }`}
                  >
                    <input
                      type="radio"
                      name={field.name}
                      value={level._id}
                      checked={isSelected}
                      onChange={() => field.onChange(level._id)}
                      className="sr-only"
                      disabled={isLoading}
                    />
                    <div className="text-center">
                      <span className={`block text-xs sm:text-sm font-bold ${isSelected ? 'text-indigo-700' : 'text-slate-600'}`}>
                        {level.name}
                      </span>
                    </div>
                    
                    {/* Check icon indicator */}
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 text-indigo-600">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      </div>
                    )}
                  </label>
                );
              }) : (
                <p className="text-sm text-slate-500 italic">{t('setup.levelEmpty', 'Dữ liệu cấp độ trống.')}</p>
              )}
            </div>
          )}
        />
        {form.formState.errors.level && (
          <p className="mt-1.5 text-xs text-red-500 font-medium flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-red-500"></span> {form.formState.errors.level.message}
          </p>
        )}
      </div>

      {/* Tech Stacks */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider">
            {t('setup.techStack', 'Bộ kỹ năng & Công nghệ')}
          </label>
          <span className="text-[11px] font-medium px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md">{t('setup.multiSelect', 'Chọn nhiều')}</span>
        </div>
        
        <Controller
          name="techStacks"
          control={form.control}
          render={({ field }) => (
            <div className="p-3.5 border-2 border-slate-100 rounded-2xl bg-slate-50/50 min-h-[90px]">
              {technologies?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {technologies.map((tech) => {
                    const isSelected = field.value.includes(tech._id);
                    return (
                      <button
                        key={tech._id}
                        type="button"
                        onClick={() => {
                          const newValue = isSelected
                            ? field.value.filter((id: string) => id !== tech._id)
                            : [...field.value, tech._id];
                          field.onChange(newValue);
                        }}
                        disabled={isLoading}
                        className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 border-2 cursor-pointer ${
                          isSelected 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20 scale-105' 
                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600 shadow-sm'
                        }`}
                      >
                        {tech.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-1.5 py-3">
                  <svg className="w-6 h-6 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                  <p className="text-xs sm:text-sm font-medium">{t('setup.selectRoleFirst', 'Vui lòng chọn chức danh ở trên để tải danh sách công nghệ')}</p>
                </div>
              )}
            </div>
          )}
        />
      </div>
    </form>
  );
};
