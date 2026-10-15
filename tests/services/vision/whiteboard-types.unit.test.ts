import { describe, it, expect } from 'vitest';
import {
  architectureNodeTypeSchema,
  architectureIssueSchema,
  visionAnalysisResultSchema,
  type ArchitectureNodeType,
  type ArchitectureIssue,
  type VisionAnalysisResult,
} from '../../../src/services/vision/types';

describe('Whiteboard Types & Zod Schemas (Micro-Task 4.1)', () => {
  it('validates supported architecture node types', () => {
    const validTypes: ArchitectureNodeType[] = [
      'CLIENT',
      'CDN',
      'LOAD_BALANCER',
      'GATEWAY',
      'SERVICE',
      'CACHE',
      'QUEUE',
      'DATABASE',
      'STORAGE',
    ];

    for (const nodeType of validTypes) {
      expect(architectureNodeTypeSchema.safeParse(nodeType).success).toBe(true);
    }

    expect(architectureNodeTypeSchema.safeParse('INVALID_NODE').success).toBe(false);
  });

  it('validates architecture issue structure with bilingual text and bounding box', () => {
    const issue: ArchitectureIssue = {
      type: 'SPOF',
      severity: 'HIGH',
      title: {
        vi: 'Điểm nghẽn duy nhất tại Database Master',
        en: 'Single Point of Failure at Database Master',
      },
      description: {
        vi: 'Hệ thống chỉ có một Database Master duy nhất không có bản sao Replica.',
        en: 'The system only has one Database Master with no replicas.',
      },
      targetBox: {
        x: 100,
        y: 200,
        width: 120,
        height: 80,
      },
      suggestedFix: {
        vi: 'Cấu hình Master-Slave Replica và cụm Multi-AZ Failover.',
        en: 'Configure Master-Slave Replication with Multi-AZ Failover.',
      },
    };

    const parsed = architectureIssueSchema.safeParse(issue);
    expect(parsed.success).toBe(true);
  });

  it('validates complete vision analysis result', () => {
    const analysis: VisionAnalysisResult = {
      detectedNodes: [
        { type: 'LOAD_BALANCER', label: 'NGINX LB' },
        { type: 'SERVICE', label: 'Order API' },
        { type: 'DATABASE', label: 'Postgres' },
      ],
      issues: [
        {
          type: 'MISSING_TIER',
          severity: 'MEDIUM',
          title: { vi: 'Thiếu bộ đệm Cache', en: 'Missing Cache Layer' },
          description: {
            vi: 'Truy vấn đọc sản phẩm trực tiếp vào DB mà không qua Redis.',
            en: 'Direct reads to DB without Redis caching.',
          },
          suggestedFix: {
            vi: 'Thêm cụm Redis Cache phía trước Database.',
            en: 'Add Redis cache in front of database.',
          },
        },
      ],
      tradeOffEvaluation: {
        vi: 'Hệ thống ưu tiên Consistency (CP) nhưng Availability (A) có thể bị ảnh hưởng khi mạng phân vùng.',
        en: 'System prioritizes Consistency (CP) but Availability may degrade during partitions.',
      },
      score: 8.5,
    };

    const parsed = visionAnalysisResultSchema.safeParse(analysis);
    expect(parsed.success).toBe(true);
  });
});
