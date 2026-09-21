import { ArrowRightOutlined, BookOutlined, FileSearchOutlined, TeamOutlined } from '@ant-design/icons';
import { Button, Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../providers/AuthProvider';

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="page dashboard-page">
      <PageHeader eyebrow="OVERVIEW" title={`你好，${user?.username ?? '管理员'}`} description="从这里开始管理 Manabi 的用户和 JLPT 真题内容。" />
      <section className="hero-card">
        <div>
          <Tag color="purple">阶段 1 已就绪</Tag>
          <h2>Manabi 内容管理中心</h2>
          <p>基础框架、管理员认证和统一设计系统已经建立。接下来将接入真实用户与真题数据。</p>
          <Button type="primary" onClick={() => navigate('/exams')}>查看真题模块 <ArrowRightOutlined /></Button>
        </div>
        <div className="hero-card__glyph">学</div>
      </section>
      <section className="dashboard-grid">
        <Card className="feature-card" hoverable onClick={() => navigate('/users')}>
          <span className="feature-card__icon feature-card__icon--blue"><TeamOutlined /></span>
          <div><h3>用户管理</h3><p>管理学习账号、等级、状态与访问权限。</p></div>
          <ArrowRightOutlined className="feature-card__arrow" />
        </Card>
        <Card className="feature-card" hoverable onClick={() => navigate('/exams')}>
          <span className="feature-card__icon feature-card__icon--violet"><BookOutlined /></span>
          <div><h3>真题管理</h3><p>维护 N1–N5 试卷、题组和阅读听力材料。</p></div>
          <ArrowRightOutlined className="feature-card__arrow" />
        </Card>
        <Card className="feature-card" hoverable onClick={() => navigate('/reviews')}>
          <span className="feature-card__icon feature-card__icon--yellow"><FileSearchOutlined /></span>
          <div><h3>内容审核</h3><p>集中处理导入质量问题与待发布修订。</p></div>
          <ArrowRightOutlined className="feature-card__arrow" />
        </Card>
      </section>
      <section className="coming-next">
        <span>接下来</span>
        <div><strong>阶段 2 · 用户管理</strong><p>分页、搜索、创建、编辑、禁用与密码重置。</p></div>
        <Tag>尚未接入</Tag>
      </section>
    </div>
  );
}
