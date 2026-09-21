import type { ThemeConfig } from 'antd';

export const manabiTheme: ThemeConfig = {
  token: {
    colorPrimary: '#4255ff',
    colorInfo: '#4255ff',
    colorSuccess: '#23a877',
    colorWarning: '#f2b729',
    colorError: '#d9363e',
    colorText: '#282e3e',
    colorTextSecondary: '#626b7f',
    colorBgLayout: '#f6f7fb',
    colorBorder: '#e4e7f0',
    borderRadius: 12,
    borderRadiusLG: 18,
    controlHeight: 42,
    fontFamily: 'Inter, "Noto Sans SC", "Noto Sans JP", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  components: {
    Button: { fontWeight: 700, primaryShadow: '0 5px 14px rgba(66, 85, 255, 0.22)' },
    Input: { activeBorderColor: '#4255ff', hoverBorderColor: '#7583ff' },
    Layout: { headerBg: '#ffffff', siderBg: '#ffffff' },
    Menu: { itemBorderRadius: 12, itemHeight: 48, itemSelectedBg: '#eef0ff', itemSelectedColor: '#4255ff' },
  },
};
