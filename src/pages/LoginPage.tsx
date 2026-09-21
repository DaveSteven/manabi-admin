import { ArrowRightOutlined, BookOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input } from 'antd';
import { useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { FullPageLoading } from '../components/feedback/FullPageLoading';
import { AdminAccessRequiredError, apiErrorMessage } from '../lib/errors';
import { useAuth } from '../providers/AuthProvider';
import type { LoginInput } from '../types/auth';

function resolveDestination(state: unknown): string {
  const from = (state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from;
  if (!from?.pathname || from.pathname === '/login') return '/';
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
}

export function LoginPage() {
  const { user, loading, login, pendingRevocations, retryPendingRevocations } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string>();
  const destination = useMemo(() => resolveDestination(location.state), [location.state]);

  if (loading) return <FullPageLoading />;
  if (user) return <Navigate to={destination} replace />;

  const submit = async (values: LoginInput) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(undefined);
    try {
      await login({ username: values.username.trim(), password: values.password });
      navigate(destination, { replace: true });
    } catch (reason) {
      if (reason instanceof AdminAccessRequiredError) {
        setError(reason.revokeFailed
          ? '此账号没有管理权限，且会话撤销失败。'
          : '此账号没有管理权限。');
      } else {
        setError(apiErrorMessage(reason, {
          status: {
            401: '账号或密码错误。',
            403: '此账号没有管理权限。',
            422: '账号或密码格式不正确。',
          },
        }));
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const retryRevocation = async () => {
    setRetrying(true);
    try {
      await retryPendingRevocations();
    } finally {
      setRetrying(false);
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
            <div><BookOutlined /><span><strong>N1–N5</strong><small>全等级真题</small></span></div>
            <div><SafetyCertificateOutlined /><span><strong>版本化</strong><small>安全发布流程</small></span></div>
          </div>
        </div>
        <p className="login-story__footer" lang="ja">学ぶことは、未来をつくること。</p>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="login-card__heading">
            <span>欢迎回来</span>
            <h2>登录管理后台</h2>
            <p>请使用已授权的管理员账号继续。</p>
          </div>
          {error && <Alert className="login-card__alert" type="error" showIcon message={error} />}
          {pendingRevocations > 0 && (
            <Alert
              className="login-card__alert"
              type="warning"
              showIcon
              message="会话撤销未完成"
              description="为避免该会话继续有效，请重试撤销。"
              action={<Button size="small" type="primary" loading={retrying} onClick={() => void retryRevocation()}>重试</Button>}
            />
          )}
          <Form<LoginInput> className="login-card__form" layout="vertical" requiredMark={false} onFinish={submit} size="large">
            <Form.Item label="管理员账号" name="username" rules={[{ required: true, message: '请输入管理员账号' }]}>
              <Input autoComplete="username" placeholder="请输入账号" />
            </Form.Item>
            <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }, { min: 8, message: '密码至少 8 位' }]}>
              <Input.Password autoComplete="current-password" placeholder="请输入密码" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} disabled={submitting} block>
              登录 <ArrowRightOutlined />
            </Button>
          </Form>
          <p className="login-card__security"><SafetyCertificateOutlined /> 管理操作将被安全记录</p>
        </div>
      </section>
    </main>
  );
}
