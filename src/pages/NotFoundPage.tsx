import { Button, Empty } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <PageHeader eyebrow="404" title="页面不存在" />
      <div className="module-placeholder">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={false} />
        <h2>找不到这个页面</h2>
        <p>地址可能已更改或输入有误，请从左侧导航选择需要的模块。</p>
        <Button type="primary" onClick={() => navigate('/')}>返回工作台</Button>
      </div>
    </div>
  );
}
