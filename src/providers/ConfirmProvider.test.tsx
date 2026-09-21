import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import { ConfirmProvider, useConfirm } from './ConfirmProvider';
import { manabiTheme } from '../theme';

function Trigger({ label, onResolve, options }: {
  label: string;
  onResolve: (value: boolean) => void;
  options: Parameters<ReturnType<typeof useConfirm>>[0];
}) {
  const confirm = useConfirm();
  return (
    <button type="button" onClick={() => { void confirm(options).then(onResolve); }}>
      {label}
    </button>
  );
}

function renderWithTheme(ui: React.ReactNode) {
  return render(
    <ConfigProvider theme={manabiTheme}>
      <ConfirmProvider>{ui}</ConfirmProvider>
    </ConfigProvider>,
  );
}

async function latestDialog(name: string): Promise<HTMLElement> {
  return waitFor(() => {
    const dialogs = screen.getAllByRole('dialog');
    const dialog = dialogs[dialogs.length - 1];
    expect(dialog).toHaveAccessibleName(name);
    return dialog;
  });
}

describe('ConfirmProvider', () => {
  it('在主题上下文中确认返回 true，且危险按钮生效', async () => {
    const results: boolean[] = [];
    renderWithTheme(
      <Trigger
        label="触发确认"
        onResolve={(value) => results.push(value)}
        options={{ title: '确认操作', content: '中文说明 日本語 English 123', danger: true }}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '触发确认' }));

    const dialog = await latestDialog('确认操作');
    expect(within(dialog).getByText('中文说明 日本語 English 123')).toBeInTheDocument();
    const okButton = within(dialog).getByRole('button', { name: /确\s*认/ });
    expect(okButton).toHaveClass('ant-btn-dangerous');

    await user.click(okButton);
    await waitFor(() => expect(results).toEqual([true]));
  });

  it('取消返回 false，并支持自定义按钮文案', async () => {
    const results: boolean[] = [];
    renderWithTheme(
      <Trigger
        label="触发删除"
        onResolve={(value) => results.push(value)}
        options={{ title: '删除用户', okText: '删除', cancelText: '保留', danger: true }}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '触发删除' }));

    const dialog = await latestDialog('删除用户');
    await user.click(within(dialog).getByRole('button', { name: /保\s*留/ }));
    await waitFor(() => expect(results).toEqual([false]));
  });

  it('可重复调用并分别返回结果', async () => {
    const results: boolean[] = [];
    renderWithTheme(
      <Trigger label="再次触发" onResolve={(value) => results.push(value)} options={{ title: '再次确认' }} />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '再次触发' }));
    await user.click(within(await latestDialog('再次确认')).getByRole('button', { name: /确\s*认/ }));
    await waitFor(() => expect(results).toEqual([true]));

    await user.click(screen.getByRole('button', { name: '再次触发' }));
    await user.click(within(await latestDialog('再次确认')).getByRole('button', { name: /取\s*消/ }));
    await waitFor(() => expect(results).toEqual([true, false]));
  });
});
