import { createContext, useContext } from 'react';

const FlowSurfaceContext = createContext<{ onColoredSurface: boolean }>({
  onColoredSurface: false,
});

export const FlowSurfaceProvider = FlowSurfaceContext.Provider;

export function useFlowSurface() {
  return useContext(FlowSurfaceContext);
}
