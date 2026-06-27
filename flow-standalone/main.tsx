import { createRoot } from 'react-dom/client';
import '@/index.css';
import { FlowBuilder } from '@/components/flow-designer/FlowBuilder';

const el = document.getElementById('root');
if (el) createRoot(el).render(<FlowBuilder />);
