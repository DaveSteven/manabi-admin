import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/feedback/StateBlock';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <PageHeader eyebrow="404" title="页面不存在" />
      <StateBlock
        title="找不到这个页面"
        description="地址可能已更改或输入有误，请从左侧导航选择需要的模块。"
        action={<Button type="primary" onClick={() => navigate('/')}>返回工作台</Button>}
      />
    </div>
  );
}
