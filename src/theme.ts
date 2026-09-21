import type { ThemeConfig } from 'antd';
import { palette, radius, typography } from './lib/designTokens';

export const manabiTheme: ThemeConfig = {
  token: {
    colorPrimary: palette.primary,
    colorInfo: palette.primary,
    colorSuccess: palette.success,
    colorWarning: palette.warning,
    colorError: palette.error,
    colorText: palette.textPrimary,
    colorTextSecondary: palette.textSecondary,
    colorBgLayout: palette.background,
    colorBorder: palette.border,
    colorBorderSecondary: palette.border,
    borderRadius: radius.md,
    borderRadiusLG: radius.lg,
    borderRadiusSM: radius.sm,
    controlHeight: 42,
    controlHeightLG: 50,
    fontFamily: typography.sans,
    fontSize: 14,
    lineHeight: 1.6,
  },
  components: {
    Button: { fontWeight: 700, primaryShadow: '0 5px 14px rgba(66, 85, 255, 0.22)' },
    Input: { activeBorderColor: palette.primary, hoverBorderColor: palette.primaryHover },
    Layout: { headerBg: palette.surface, siderBg: palette.surface },
    Menu: { itemBorderRadius: radius.md, itemHeight: 48, itemSelectedBg: palette.primaryLight, itemSelectedColor: palette.primary },
    Card: { borderRadiusLG: radius.lg },
    Modal: { borderRadiusLG: radius.lg },
  },
};
