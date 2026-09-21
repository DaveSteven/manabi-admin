import { createRoot, type Root } from 'react-dom/client';
import { unstableSetRender } from 'antd';

type RootContainer = Element & { _reactRoot?: Root };

// React 19 compatibility for antd v5 static render paths (Button wave, static
// message/notification/modal). Mirrors the official @ant-design/v5-patch-for-react-19
// without adding a dependency. Must run before the first antd render.
export function patchAntdForReact19(): void {
  unstableSetRender((node, container) => {
    const target = container as RootContainer;
    target._reactRoot ??= createRoot(container);
    const root = target._reactRoot;
    root.render(node);
    return async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      root.unmount();
    };
  });
}
