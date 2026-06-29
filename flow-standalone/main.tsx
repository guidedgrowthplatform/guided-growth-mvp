import { createRoot } from 'react-dom/client';
import '@/index.css';
import { FlowDesigner } from '@/components/flow-designer/FlowDesigner';

const el = document.getElementById('root');
if (el) createRoot(el).render(<FlowDesigner />);
