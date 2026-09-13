export const parseEnabledFlag = (value: unknown): boolean => value === 'true';

export const featureFlags = Object.freeze({
  questionBankAdminUi: parseEnabledFlag(
    import.meta.env.VITE_QUESTION_BANK_ADMIN_UI_ENABLED
  ),
});

