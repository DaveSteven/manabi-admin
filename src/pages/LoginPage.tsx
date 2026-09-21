import { ArrowRightOutlined, BookOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input } from 'antd';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { errorMessage } from '../lib/api';
import { useAuth } from '../providers/AuthProvider';
import type { LoginInput } from '../types/auth';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  if (user) return <Navigate to="/" replace />;

  const submit = async (values: LoginInput) => {
    setSubmitting(true);
    setError(undefined);
    try {
      await login(values);
      const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';
      navigate(destination, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error && reason.message === 'ADMIN_REQUIRED'
        ? '此账号没有管理权限。'
        : errorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-story">
        <Brand />
        <div className="login-story__content">
          <span className="story-kicker">MANABI CONTENT STUDIO</span>
          <h1>让每一道真题，<br />都值得认真学习。</h1>
          <p>集中维护 JLPT N1–N5 真题、学习用户与内容质量，为 Manabi 提供可靠的学习体验。</p>
          <div className="story-cards">
            <div><BookOutlined /><span><strong>103</strong><small>套真题内容</small></span></div>
            <div><SafetyCertificateOutlined /><span><strong>版本化</strong><small>安全发布流程</small></span></div>
          </div>
        </div>
        <p className="login-story__footer">学ぶことは、未来をつくること。</p>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="login-card__heading">
            <span>欢迎回来</span>
            <h2>登录管理后台</h2>
            <p>请使用已授权的管理员账号继续。</p>
          </div>
          {error && <Alert type="error" showIcon message={error} />}
          <Form<LoginInput> layout="vertical" requiredMark={false} onFinish={submit} size="large">
            <Form.Item label="管理员账号" name="username" rules={[{ required: true, message: '请输入管理员账号' }]}>
              <Input autoComplete="username" placeholder="请输入账号" />
            </Form.Item>
            <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }, { min: 8, message: '密码至少 8 位' }]}>
              <Input.Password autoComplete="current-password" placeholder="请输入密码" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} block>
              登录 <ArrowRightOutlined />
            </Button>
          </Form>
          <p className="login-card__security"><SafetyCertificateOutlined /> 管理操作将被安全记录</p>
        </div>
      </section>
    </main>
  );
}
