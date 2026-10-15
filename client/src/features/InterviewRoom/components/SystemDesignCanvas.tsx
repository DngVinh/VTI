import React, { useRef } from 'react';
import type { ArchitectureCritiqueData } from '../types';
import type { ArchitectureNode, ArchitectureEdge } from '../hooks/useSystemDesignWhiteboard';
import { ArchitectureCritiqueOverlay } from './ArchitectureCritiqueOverlay';

export interface SystemDesignCanvasProps {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  onAddNode: (type: string, label: string, x: number, y: number) => void;
  onAddEdge: (from: string, to: string, protocol?: string) => void;
  onSubmitSnapshot: () => void;
  isSubmitting?: boolean;
  critique?: ArchitectureCritiqueData | null;
  onCloseCritique?: () => void;
  onClear?: () => void;
}

const TOOLBAR_ITEMS = [
  { type: 'CLIENT', label: 'Client / App', icon: '📱' },
  { type: 'LOAD_BALANCER', label: 'Load Balancer', icon: '⚖️' },
  { type: 'SERVICE', label: 'Service Pod', icon: '⚙️' },
  { type: 'CACHE', label: 'Cache (Redis)', icon: '⚡' },
  { type: 'QUEUE', label: 'Queue (Kafka)', icon: '📬' },
  { type: 'DATABASE', label: 'Database', icon: '🗄️' },
  { type: 'STORAGE', label: 'Storage (S3)', icon: '📦' },
];

export const SystemDesignCanvas: React.FC<SystemDesignCanvasProps> = ({
  nodes,
  edges,
  onAddNode,
  onSubmitSnapshot,
  isSubmitting = false,
  critique,
  onCloseCritique,
  onClear,
}) => {
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const handleToolbarAdd = (type: string, defaultLabel: string) => {
    // Generate scattered default coordinates
    const offset = (nodes.length % 6) * 50;
    const x = 80 + offset;
    const y = 80 + (offset % 120);
    onAddNode(type, defaultLabel, x, y);
  };

  return (
    <div className="relative flex-1 flex flex-col min-h-[460px] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl text-slate-100 select-none">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-200 flex items-center gap-1.5">
            <span>🏛️</span>
            <span>Bảng vẽ Kiến trúc Hệ thống</span>
          </span>
          <span className="text-slate-500 font-mono text-[11px]">
            ({nodes.length} nút, {edges.length} liên kết)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="px-2.5 py-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors text-xs font-medium"
            >
              Làm mới
            </button>
          )}

          <button
            type="button"
            onClick={onSubmitSnapshot}
            disabled={isSubmitting || nodes.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md ${
              isSubmitting || nodes.length === 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 shadow-indigo-950'
            }`}
          >
            {isSubmitting ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
                <span>AI Vision đang quét...</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>Phản biện kiến trúc</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Workspace: Toolbar + Canvas Surface */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Side Toolbar */}
        <div className="w-44 bg-slate-900/80 border-r border-slate-800/80 p-2.5 flex flex-col gap-1.5 shrink-0 z-10">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold px-1.5 mb-1">
            Khối kiến trúc
          </span>
          {TOOLBAR_ITEMS.map((item) => (
            <button
              key={item.type}
              type="button"
              aria-label={`Thêm ${item.label}`}
              onClick={() => handleToolbarAdd(item.type, item.label)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 hover:border-indigo-500/50 transition-all text-left group"
            >
              <span className="text-base group-hover:scale-110 transition-transform">
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Canvas Surface with Grid Background */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-auto bg-slate-950 [background-image:radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] min-h-[380px]"
        >
          {/* Nodes Rendering */}
          {nodes.map((node) => (
            <div
              key={node.id}
              style={{ left: `${node.x}px`, top: `${node.y}px` }}
              className="absolute p-3 bg-slate-900 border-2 border-indigo-500/50 hover:border-indigo-400 rounded-2xl shadow-xl flex items-center gap-2.5 cursor-grab active:cursor-grabbing text-xs text-slate-100 transition-shadow select-none group"
            >
              <span className="text-lg">
                {node.type === 'DATABASE'
                  ? '🗄️'
                  : node.type === 'CACHE'
                  ? '⚡'
                  : node.type === 'QUEUE'
                  ? '📬'
                  : node.type === 'LOAD_BALANCER'
                  ? '⚖️'
                  : node.type === 'STORAGE'
                  ? '📦'
                  : '⚙️'}
              </span>
              <div className="flex flex-col">
                <span className="font-bold leading-tight">{node.label}</span>
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">
                  {node.type}
                </span>
              </div>
            </div>
          ))}

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 text-xs pointer-events-none">
              <span className="text-3xl mb-2 opacity-50">📐</span>
              <span>Kéo hoặc bấm vào khối kiến trúc ở thanh bên trái để bắt đầu thiết kế</span>
            </div>
          )}

          {/* AI Vision Architecture Critique Overlay */}
          {critique && (
            <ArchitectureCritiqueOverlay
              critique={critique}
              onClose={onCloseCritique || (() => {})}
            />
          )}
        </div>
      </div>
    </div>
  );
};
