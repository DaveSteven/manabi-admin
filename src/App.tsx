import { AuditOutlined, FileSearchOutlined, PictureOutlined } from '@ant-design/icons';
import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminLayout } from './layout/AdminLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ExamsPage } from './pages/ExamsPage';
import { LoginPage } from './pages/LoginPage';
import { ModulePlaceholderPage } from './pages/ModulePlaceholderPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { UsersPage } from './pages/UsersPage';
import { UserDetailPage } from './pages/UserDetailPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/:userId" element={<UserDetailPage />} />
          <Route path="exams" element={<ExamsPage />} />
          <Route path="reviews" element={<ModulePlaceholderPage eyebrow="QUALITY" title="内容审核" description="处理质量问题、内容修订与发布审核。" icon={<FileSearchOutlined />} phase="阶段 6" />} />
          <Route path="assets" element={<ModulePlaceholderPage eyebrow="MEDIA" title="媒体资源" description="统一查看图片、音频及字幕资源。" icon={<PictureOutlined />} phase="阶段 5" />} />
          <Route path="audit-logs" element={<ModulePlaceholderPage eyebrow="HISTORY" title="操作记录" description="追踪管理员对账号和内容的关键操作。" icon={<AuditOutlined />} phase="阶段 4" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
