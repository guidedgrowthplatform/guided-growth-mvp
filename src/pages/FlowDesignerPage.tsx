import { FlowDesigner } from '@/components/flow-designer/FlowDesigner';

/**
 * Dev-only page (gated by import.meta.env.DEV in the router) that hosts the
 * FlowDesigner. Lets you preview the chat-native onboarding flow built from
 * the real app components, inside the running app.
 */
export function FlowDesignerPage() {
  return <FlowDesigner />;
}
