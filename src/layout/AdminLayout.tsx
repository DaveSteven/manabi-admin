import {
  AuditOutlined,
  BookOutlined,
  DashboardOutlined,
  FileSearchOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PictureOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Dropdown, Layout, Menu, type MenuProps } from 'antd';
import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { useAuth } from '../providers/AuthProvider';

const { Header, Sider, Content } = Layout;

const menuItems: MenuProps['items'] = [
  { key: '/', icon: <DashboardOutlined />, label: '工作台' },
  { key: '/users', icon: <UserOutlined />, label: '用户管理' },
  { key: '/exams', icon: <BookOutlined />, label: '真题管理' },
  { key: '/reviews', icon: <FileSearchOutlined />, label: '内容审核' },
  { key: '/assets', icon: <PictureOutlined />, label: '媒体资源' },
  { key: '/audit-logs', icon: <AuditOutlined />, label: '操作记录' },
];

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const selected = useMemo(() => {
    const item = menuItems?.find((entry) => entry && 'key' in entry && entry.key !== '/' && location.pathname.startsWith(String(entry.key)));
    return String(item && 'key' in item ? item.key : '/');
  }, [location.pathname]);

  return (
    <Layout className="admin-shell">
      <Sider width={250} collapsedWidth={84} collapsed={collapsed} trigger={null} className="admin-sider">
        <div className="admin-sider__brand"><Brand compact={collapsed} /></div>
        <Menu mode="inline" items={menuItems} selectedKeys={[selected]} onClick={({ key }) => navigate(key)} />
        <div className="admin-sider__footer">{collapsed ? 'M' : 'Manabi · 学び続ける'}</div>
      </Sider>
      <Layout>
        <Header className="admin-header">
          <Button type="text" className="collapse-button" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} />
          <div className="admin-header__right">
            <span className="environment-pill"><i /> 管理控制台</span>
            <Dropdown
              menu={{ items: [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: () => void logout() }] }}
              placement="bottomRight"
            >
              <button className="profile-button">
                <Avatar size={36}>{user?.username?.slice(0, 1).toUpperCase()}</Avatar>
                <span><strong>{user?.username}</strong><small>{user?.level} · 管理员</small></span>
              </button>
            </Dropdown>
          </div>
        </Header>
        <Content className="admin-content"><Outlet /></Content>
      </Layout>
    </Layout>
  );
}
