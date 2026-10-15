import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { ComplexityAnalyzer } from '../../../src/services/code-sandbox/ComplexityAnalyzer';

describe('ComplexityAnalyzer (Micro-Task 3.4)', () => {
  const analyzer = new ComplexityAnalyzer();

  it('estimates O(1) time complexity for flat code without loops', () => {
    const code = `
      function add(a: number, b: number): number {
        const sum = a + b;
        return sum;
      }
    `;

    const result = analyzer.analyze(code);
    expect(result.estimatedTimeComplexity).toBe('O(1)');
    expect(result.maxLoopNesting).toBe(0);
    expect(result.cyclomaticComplexity).toBe(1);
    expect(result.hasRecursion).toBe(false);
  });

  it('estimates O(N) time complexity for a single loop', () => {
    const code = `
      function findMax(nums: number[]): number {
        let max = nums[0];
        for (let i = 1; i < nums.length; i++) {
          if (nums[i] > max) {
            max = nums[i];
          }
        }
        return max;
      }
    `;

    const result = analyzer.analyze(code);
    expect(result.estimatedTimeComplexity).toBe('O(N)');
    expect(result.maxLoopNesting).toBe(1);
    expect(result.cyclomaticComplexity).toBeGreaterThanOrEqual(2);
  });

  it('estimates O(N^2) time complexity for nested loops', () => {
    const code = `
      function bubbleSort(arr: number[]): number[] {
        for (let i = 0; i < arr.length; i++) {
          for (let j = 0; j < arr.length - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
              const temp = arr[j];
              arr[j] = arr[j + 1];
              arr[j + 1] = temp;
            }
          }
        }
        return arr;
      }
    `;

    const result = analyzer.analyze(code);
    expect(result.estimatedTimeComplexity).toBe('O(N^2)');
    expect(result.maxLoopNesting).toBe(2);
  });

  it('detects recursion and flags hasRecursion as true', () => {
    const code = `
      function fibonacci(n: number): number {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
      }
    `;

    const result = analyzer.analyze(code);
    expect(result.hasRecursion).toBe(true);
    expect(result.estimatedTimeComplexity).toBe('O(2^N)');
  });

  it('identifies code smells like empty catch blocks', () => {
    const code = `
      function parseData(jsonStr: string) {
        try {
          return JSON.parse(jsonStr);
        } catch (e) {
          // Empty catch block
        }
      }
    `;

    const result = analyzer.analyze(code);
    expect(result.detectedSmells).toContain('EMPTY_CATCH_BLOCK');
  });
});
