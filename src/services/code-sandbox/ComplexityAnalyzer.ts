import { injectable } from 'tsyringe';

export interface ComplexityAnalysisResult {
  estimatedTimeComplexity: 'O(1)' | 'O(log N)' | 'O(N)' | 'O(N log N)' | 'O(N^2)' | 'O(N^3+)' | 'O(2^N)';
  estimatedSpaceComplexity: 'O(1)' | 'O(N)' | 'O(N^2)';
  cyclomaticComplexity: number;
  maxLoopNesting: number;
  hasRecursion: boolean;
  detectedSmells: string[];
}

@injectable()
export class ComplexityAnalyzer {
  analyze(code: string): ComplexityAnalysisResult {
    const detectedSmells: string[] = [];

    // 1. Check empty catch block before stripping comments
    const emptyCatchRegex = /catch\s*(?:\([^)]*\))?\s*\{(?:\s*|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*\}/g;
    if (emptyCatchRegex.test(code)) {
      detectedSmells.push('EMPTY_CATCH_BLOCK');
    }

    // 2. Clean comments and string literals for reliable parsing
    const cleanedCode = this.stripCommentsAndStrings(code);

    // 3. Compute Cyclomatic Complexity
    let cyclomaticComplexity = 1;
    const decisionPatterns = [
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bwhile\s*\(/g,
      /\bfor\s*\(/g,
      /\bcase\s+[^:]+:/g,
      /\bcatch\s*(?:\([^)]*\))?\s*\{/g,
      /&&/g,
      /\|\|/g,
      /\?\?/g,
      /\?(?!\.|\?)/g, // ternary ? (excluding optional chaining ?. and ??)
    ];

    for (const pattern of decisionPatterns) {
      const matches = cleanedCode.match(pattern);
      if (matches) {
        cyclomaticComplexity += matches.length;
      }
    }

    // 4. Analyze Loop Nesting Depth
    const maxLoopNesting = this.calculateMaxLoopNesting(cleanedCode);

    // 5. Detect Recursion
    const { hasRecursion, recursiveCallCount } = this.detectRecursion(cleanedCode);

    // 6. Estimate Time & Space Complexity
    let estimatedTimeComplexity: ComplexityAnalysisResult['estimatedTimeComplexity'];
    if (hasRecursion) {
      if (recursiveCallCount >= 2) {
        estimatedTimeComplexity = 'O(2^N)';
      } else {
        estimatedTimeComplexity = maxLoopNesting > 0 ? 'O(N^2)' : 'O(N)';
      }
    } else {
      switch (maxLoopNesting) {
        case 0:
          estimatedTimeComplexity = 'O(1)';
          break;
        case 1:
          estimatedTimeComplexity = 'O(N)';
          break;
        case 2:
          estimatedTimeComplexity = 'O(N^2)';
          break;
        default:
          estimatedTimeComplexity = 'O(N^3+)';
          break;
      }
    }

    const estimatedSpaceComplexity: ComplexityAnalysisResult['estimatedSpaceComplexity'] =
      hasRecursion || maxLoopNesting > 1 ? 'O(N)' : 'O(1)';

    return {
      estimatedTimeComplexity,
      estimatedSpaceComplexity,
      cyclomaticComplexity,
      maxLoopNesting,
      hasRecursion,
      detectedSmells,
    };
  }

  private stripCommentsAndStrings(code: string): string {
    let result = '';
    let i = 0;
    const len = code.length;

    while (i < len) {
      const char = code[i];
      const next = code[i + 1];

      // Single line comment
      if (char === '/' && next === '/') {
        i += 2;
        while (i < len && code[i] !== '\n') i++;
        result += ' ';
        continue;
      }

      // Multi line comment
      if (char === '/' && next === '*') {
        i += 2;
        while (i < len && !(code[i] === '*' && code[i + 1] === '/')) i++;
        i += 2;
        result += ' ';
        continue;
      }

      // Strings
      if (char === '"' || char === "'" || char === '`') {
        const quote = char;
        i++;
        while (i < len && code[i] !== quote) {
          if (code[i] === '\\') i++; // Skip escaped char
          i++;
        }
        i++; // skip closing quote
        result += '""';
        continue;
      }

      result += char;
      i++;
    }

    return result;
  }

  private calculateMaxLoopNesting(code: string): number {
    let maxNesting = 0;
    let currentNesting = 0;
    const loopScopeDepths: number[] = [];

    // Tokenize braces and loop headers
    const loopHeaderRegex = /\b(for|while|do)\b/g;
    const loopIndices: number[] = [];
    let match: RegExpExecArray | null;

    while ((match = loopHeaderRegex.exec(code)) !== null) {
      loopIndices.push(match.index);
    }

    let braceDepth = 0;
    let loopPtr = 0;

    for (let i = 0; i < code.length; i++) {
      // Check if entering a loop
      while (loopPtr < loopIndices.length && loopIndices[loopPtr] === i) {
        // Mark that next block brace belongs to this loop
        loopScopeDepths.push(braceDepth + 1);
        currentNesting++;
        if (currentNesting > maxNesting) {
          maxNesting = currentNesting;
        }
        loopPtr++;
      }

      if (code[i] === '{') {
        braceDepth++;
      } else if (code[i] === '}') {
        // Check if closing a loop block
        while (
          loopScopeDepths.length > 0 &&
          loopScopeDepths[loopScopeDepths.length - 1] === braceDepth
        ) {
          loopScopeDepths.pop();
          currentNesting = Math.max(0, currentNesting - 1);
        }
        braceDepth--;
      }
    }

    return maxNesting;
  }

  private detectRecursion(code: string): { hasRecursion: boolean; recursiveCallCount: number } {
    // Match function declarations: function name(...): returnType { ... }
    const funcDeclRegex = /function\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)(?::\s*[^{]+)?\s*\{/g;
    let match: RegExpExecArray | null;

    let hasRecursion = false;
    let recursiveCallCount = 0;

    while ((match = funcDeclRegex.exec(code)) !== null) {
      const funcName = match[1];
      const startIndex = match.index + match[0].length - 1;

      // Find function body end using brace counting
      let depth = 0;
      let bodyEnd = -1;
      for (let i = startIndex; i < code.length; i++) {
        if (code[i] === '{') depth++;
        else if (code[i] === '}') {
          depth--;
          if (depth === 0) {
            bodyEnd = i;
            break;
          }
        }
      }

      if (bodyEnd !== -1) {
        const body = code.substring(startIndex, bodyEnd);
        // Look for calls to funcName in body
        const callRegex = new RegExp(`\\b${funcName}\\s*\\(`, 'g');
        const calls = body.match(callRegex);
        if (calls && calls.length > 0) {
          hasRecursion = true;
          recursiveCallCount += calls.length;
        }
      }
    }

    return { hasRecursion, recursiveCallCount };
  }
}
