import { useState, useCallback } from 'react';
import { interviewApi } from '../../../services/api/interviewApi';
import type { ArchitectureCritiqueData } from '../types';

export interface UseSystemDesignWhiteboardOptions {
  sessionId: string;
  questionId: string;
}

export interface ArchitectureNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
}

export interface ArchitectureEdge {
  id: string;
  from: string;
  to: string;
  protocol?: string;
}

export const useSystemDesignWhiteboard = ({
  sessionId,
  questionId,
}: UseSystemDesignWhiteboardOptions) => {
  const [nodes, setNodes] = useState<ArchitectureNode[]>([]);
  const [edges, setEdges] = useState<ArchitectureEdge[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [critique, setCritique] = useState<ArchitectureCritiqueData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addNode = useCallback((type: string, label: string, x: number, y: number) => {
    const newNode: ArchitectureNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type,
      label,
      x,
      y,
    };
    setNodes((prev) => [...prev, newNode]);
    return newNode;
  }, []);

  const addEdge = useCallback((from: string, to: string, protocol: string = 'HTTP') => {
    const newEdge: ArchitectureEdge = {
      id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      from,
      to,
      protocol,
    };
    setEdges((prev) => [...prev, newEdge]);
    return newEdge;
  }, []);

  const submitWhiteboard = useCallback(
    async (imageBase64: string) => {
      if (!sessionId || !questionId) return null;
      setIsSubmitting(true);
      setError(null);

      try {
        const response = await interviewApi.submitWhiteboardSnapshot(sessionId, {
          questionId,
          imageBase64,
          mimeType: 'image/png',
          canvasData: { nodes, edges },
        });

        if (response?.analysis) {
          setCritique(response.analysis);
        }
        return response;
      } catch (err: any) {
        const msg = err?.message || 'Không thể gửi bản vẽ kiến trúc';
        setError(msg);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [sessionId, questionId, nodes, edges]
  );

  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setCritique(null);
    setError(null);
  }, []);

  return {
    nodes,
    edges,
    isSubmitting,
    critique,
    error,
    addNode,
    addEdge,
    submitWhiteboard,
    clearCanvas,
  };
};
