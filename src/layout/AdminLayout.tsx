import {
  AuditOutlined,
  BookOutlined,
  DashboardOutlined,
  FileSearchOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  PictureOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Drawer, Dropdown, Layout, Menu, type MenuProps } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { useAuth } from '../providers/AuthProvider';

const { Header, Sider, Content } = Layout;

const MOBILE_NAV_QUERY = '(max-width: 767.98px)';

const menuItems: MenuProps['items'] = [
  { key: '/', icon: <DashboardOutlined />, label: '工作台' },
  { key: '/users', icon: <UserOutlined />, label: '用户管理' },
  { key: '/exams', icon: <BookOutlined />, label: '真题管理' },
  { key: '/reviews', icon: <FileSearchOutlined />, label: '内容审核' },
  { key: '/assets', icon: <PictureOutlined />, label: '媒体资源' },
  { key: '/audit-logs', icon: <AuditOutlined />, label: '操作记录' },
];

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(query).matches
  ));

  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', update);
      return () => mql.removeEventListener('change', update);
    }
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, [query]);

  return matches;
}

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const isMobile = useMediaQuery(MOBILE_NAV_QUERY);

  const selected = useMemo(() => {
    if (location.pathname === '/') return ['/'];
    const match = menuItems?.find((entry) => {
      if (!entry || !('key' in entry) || entry.key === '/') return false;
      const key = String(entry.key);
      return location.pathname === key || location.pathname.startsWith(`${key}/`);
    });
    return match && 'key' in match ? [String(match.key)] : [];
  }, [location.pathname]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
    setDrawerOpen(false);
  };

  const menu = <Menu mode="inline" items={menuItems} selectedKeys={selected} onClick={handleMenuClick} />;

  return (
    <Layout className="admin-shell">
      {isMobile ? (
        <Drawer
          placement="left"
          width={250}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          rootClassName="admin-drawer"
        >
          <div className="admin-sider__brand"><Brand /></div>
          {menu}
        </Drawer>
      ) : (
        <Sider
          width={250}
          collapsedWidth={84}
          collapsed={collapsed}
          trigger={null}
          className="admin-sider"
          breakpoint="lg"
          onBreakpoint={(broken) => setCollapsed(broken)}
        >
          <div className="admin-sider__brand"><Brand compact={collapsed} /></div>
          {menu}
          <div className="admin-sider__footer">
            {collapsed ? 'M' : <>Manabi · <span lang="ja">学び続ける</span></>}
          </div>
        </Sider>
      )}
      <Layout>
        <Header className="admin-header">
          <Button
            type="text"
            className="collapse-button"
            aria-label={isMobile ? '打开导航' : collapsed ? '展开导航' : '折叠导航'}
            icon={isMobile ? <MenuOutlined /> : collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => {
              if (isMobile) setDrawerOpen(true);
              else setCollapsed(!collapsed);
            }}
          />
          <div className="admin-header__right">
            <span className="environment-pill"><i /> 管理控制台</span>
            <Dropdown
              trigger={['click']}
              menu={{ items: [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: () => void logout() }] }}
              placement="bottomRight"
            >
              <button type="button" className="profile-button">
                <Avatar size={36}>{user?.username?.slice(0, 1).toUpperCase()}</Avatar>
                <span className="profile-button__text"><strong>{user?.username}</strong></span>
              </button>
            </Dropdown>
          </div>
        </Header>
        <Content className="admin-content"><Outlet /></Content>
      </Layout>
    </Layout>
  );
}
