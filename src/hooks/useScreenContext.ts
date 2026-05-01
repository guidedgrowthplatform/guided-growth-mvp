/**
 * MOCK STUB FOR MINTESNOT
 * 
 * This hook will eventually return the real AI context block and state delta
 * for the current screen, pulling from the session_log table and static config.
 * 
 * TODO(@mintesnotm): Implement the real logic here.
 */
export function useScreenContext(screen: string) {
  return {
    aiContextBlock: `[MOCK] User is on screen: ${screen}. The user is currently navigating the onboarding flow.`,
    stateDelta: `[MOCK] User recently entered ${screen} and is evaluating options.`,
  };
}
