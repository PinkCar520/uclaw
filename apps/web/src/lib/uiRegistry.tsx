import type { UIKit, UIComponentType } from '../types/ui-protocol';
import type { ComponentType, ReactElement } from 'react';
import { AlertTriangle } from 'lucide-react';

// ──────────────────────────────────────────────
// UI Registry — 运行时注册中心
// ──────────────────────────────────────────────

type UIRendererComponent<T extends UIKit = UIKit> = ComponentType<{
  uiKit: T;
  onAction?: (actionId: string, payload: unknown) => void;
}>;

const registry = new Map<UIComponentType, UIRendererComponent>();

export function registerUIRenderer(
  type: UIComponentType,
  component: UIRendererComponent,
): void {
  registry.set(type, component);
}

export function getUIRenderer(type: UIComponentType): UIRendererComponent | null {
  return registry.get(type) ?? null;
}

export function getRegisteredTypes(): UIComponentType[] {
  return Array.from(registry.keys());
}

export function renderUIKit(
  uiKit: UIKit,
  onAction?: (actionId: string, payload: unknown) => void,
): ReactElement | null {
  if (!uiKit || !uiKit.uiType) {
    return null;
  }
  const Renderer = registry.get(uiKit.uiType);
  if (!Renderer) {
    return <UnknownUIFallback uiKit={uiKit} />;
  }
  return <Renderer uiKit={uiKit as any} onAction={onAction} />;
}

// ──────────────────────────────────────────────
// 未知类型降级渲染
// ──────────────────────────────────────────────

function UnknownUIFallback({ uiKit }: { uiKit: UIKit }) {
  return (
    <div className="my-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-[12px] text-amber-700">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="w-4 h-4" />
        <p className="font-bold">未知的 UI 组件类型: {uiKit.uiType}</p>
      </div>
      <pre className="text-[10px] font-mono overflow-auto max-h-32 mt-2 opacity-70">
        {JSON.stringify(uiKit, null, 2)}
      </pre>
    </div>
  );
}
