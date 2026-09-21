import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Modal } from 'antd';

export interface ConfirmOptions {
  title: string;
  content?: ReactNode;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [modal, contextHolder] = Modal.useModal();

  const confirm = useMemo<ConfirmFn>(() => (options) => new Promise<boolean>((resolve) => {
    modal.confirm({
      title: options.title,
      content: options.content,
      okText: options.okText ?? '确认',
      cancelText: options.cancelText ?? '取消',
      centered: true,
      okButtonProps: { danger: options.danger },
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  }), [modal]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {contextHolder}
      {children}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used inside ConfirmProvider');
  return context;
}
