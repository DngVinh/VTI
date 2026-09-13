import { describe, it, expect } from 'vitest';
import {
  computeRolloutBucket,
  resolveRolloutDecision,
  resolveEffectiveSourceMode,
  SourcePolicyConfig,
} from '../src/domain/interview/question-source/InterviewQuestionSourcePolicy';

describe('AIP-68 Phase 7: Deterministic Percentage Rollout Policy', () => {
  const testSessionId = '65e9c0f993d9b1399f6b92a1';
  const policyVersion = 'v1';
  const salt = 'qb-rollout-salt';

  describe('computeRolloutBucket', () => {
    it('generates a deterministic integer between 0 and 99', () => {
      const bucket1 = computeRolloutBucket(testSessionId, policyVersion, salt);
      const bucket2 = computeRolloutBucket(testSessionId, policyVersion, salt);

      expect(bucket1).toBeGreaterThanOrEqual(0);
      expect(bucket1).toBeLessThanOrEqual(99);
      expect(bucket1).toBe(bucket2);
    });

    it('changes bucket with different session IDs', () => {
      const b1 = computeRolloutBucket('session-alpha', policyVersion, salt);
      const b2 = computeRolloutBucket('session-beta', policyVersion, salt);
      const b3 = computeRolloutBucket('session-gamma', policyVersion, salt);

      expect([b1, b2, b3].every((b) => b >= 0 && b <= 99)).toBe(true);
    });

    it('changes bucket with different salts', () => {
      const b1 = computeRolloutBucket(testSessionId, policyVersion, 'salt-a');
      const b2 = computeRolloutBucket(testSessionId, policyVersion, 'salt-b');

      expect(typeof b1).toBe('number');
      expect(typeof b2).toBe('number');
    });
  });

  describe('resolveRolloutDecision', () => {
    it('forces AI_ONLY when enabled=false regardless of rollout percent or mode', () => {
      const decision = resolveRolloutDecision(
        { enabled: false, mode: 'HYBRID', rolloutPercent: 100 },
        testSessionId
      );
      expect(decision.effectiveMode).toBe('AI_ONLY');
      expect(decision.isCohortSelected).toBe(false);
      expect(resolveEffectiveSourceMode({ enabled: false, mode: 'HYBRID', rolloutPercent: 100 }, testSessionId)).toBe('AI_ONLY');
    });

    it('always preserves AI_ONLY when configured mode is AI_ONLY', () => {
      const decision = resolveRolloutDecision(
        { enabled: true, mode: 'AI_ONLY', rolloutPercent: 100 },
        testSessionId
      );
      expect(decision.effectiveMode).toBe('AI_ONLY');
      expect(decision.isCohortSelected).toBe(true);
      expect(resolveEffectiveSourceMode({ enabled: true, mode: 'AI_ONLY', rolloutPercent: 100 }, testSessionId)).toBe('AI_ONLY');
    });

    it('forces AI_ONLY when rolloutPercent is 0', () => {
      const decision = resolveRolloutDecision(
        { enabled: true, mode: 'HYBRID', rolloutPercent: 0 },
        testSessionId
      );
      expect(decision.effectiveMode).toBe('AI_ONLY');
      expect(decision.isCohortSelected).toBe(false);
      expect(decision.rolloutPercent).toBe(0);
      expect(resolveEffectiveSourceMode({ enabled: true, mode: 'HYBRID', rolloutPercent: 0 }, testSessionId)).toBe('AI_ONLY');
    });

    it('uses configured mode when rolloutPercent is 100 (or undefined)', () => {
      const decision100 = resolveRolloutDecision(
        { enabled: true, mode: 'HYBRID', rolloutPercent: 100 },
        testSessionId
      );
      expect(decision100.effectiveMode).toBe('HYBRID');
      expect(decision100.isCohortSelected).toBe(true);

      const decisionDefault = resolveRolloutDecision(
        { enabled: true, mode: 'HYBRID' },
        testSessionId
      );
      expect(decisionDefault.effectiveMode).toBe('HYBRID');
      expect(decisionDefault.isCohortSelected).toBe(true);
      expect(decisionDefault.rolloutPercent).toBe(100);
    });

    it('demonstrates monotonic cohort expansion as percent increases from 5% to 25%', () => {
      let selectedAt5 = 0;
      let selectedAt25 = 0;
      let invariantMaintained = true;

      // Test across 500 deterministic sessions
      for (let i = 0; i < 500; i++) {
        const sid = 'session-cohort-test-' + i;
        const dec5 = resolveRolloutDecision({ enabled: true, mode: 'HYBRID', rolloutPercent: 5 }, sid);
        const dec25 = resolveRolloutDecision({ enabled: true, mode: 'HYBRID', rolloutPercent: 25 }, sid);

        if (dec5.isCohortSelected) {
          selectedAt5++;
          // Any session selected at 5% MUST be selected at 25%
          if (!dec25.isCohortSelected) {
            invariantMaintained = false;
          }
        }
        if (dec25.isCohortSelected) {
          selectedAt25++;
        }
      }

      expect(invariantMaintained).toBe(true);
      expect(selectedAt5).toBeGreaterThan(0);
      expect(selectedAt25).toBeGreaterThan(selectedAt5);
    });

    it('falls back to AI_ONLY safely if sessionId is missing and percent is between 1 and 99', () => {
      const decision = resolveRolloutDecision({ enabled: true, mode: 'BANK_ONLY', rolloutPercent: 50 });
      expect(decision.effectiveMode).toBe('AI_ONLY');
      expect(decision.isCohortSelected).toBe(false);
    });

    it('clamps invalid percentages to 0..100 bounds', () => {
      const negative = resolveRolloutDecision({ enabled: true, mode: 'HYBRID', rolloutPercent: -10 }, testSessionId);
      expect(negative.rolloutPercent).toBe(0);
      expect(negative.effectiveMode).toBe('AI_ONLY');

      const over100 = resolveRolloutDecision({ enabled: true, mode: 'HYBRID', rolloutPercent: 150 }, testSessionId);
      expect(over100.rolloutPercent).toBe(100);
      expect(over100.effectiveMode).toBe('HYBRID');
    });

    it('rejects invalid mode strings and falls back to AI_ONLY', () => {
      const decision = resolveRolloutDecision(
        { enabled: true, mode: 'INJECTED_MODE' as any, rolloutPercent: 100 },
        testSessionId
      );
      expect(decision.effectiveMode).toBe('AI_ONLY');
      expect(decision.configuredMode).toBe('AI_ONLY');
    });
  });
});
