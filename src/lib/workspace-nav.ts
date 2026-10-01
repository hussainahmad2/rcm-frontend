import type { WorkspaceView } from '@/pages/workspace/workspace-types';

type NavHandler = (view: WorkspaceView) => void;

let handler: NavHandler | null = null;

/** Workspace shell registers this so toasts / global UI can jump to a screen. */
export function registerWorkspaceNavigator(fn: NavHandler) {
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
}

export function navigateWorkspace(view: WorkspaceView) {
  handler?.(view);
}

const USE_CASE_TO_VIEW: Record<string, WorkspaceView> = {
  eligibility_check: 'eligibility',
  coding_qa: 'coding',
  claim_qa: 'claims',
  authorization_risk: 'authorizations',
  denial_analysis: 'denials',
  appeal_draft: 'denials',
  payment_variance: 'payments',
  ar_prioritize: 'ar',
  audit_anomaly: 'settings',
  contract_variance: 'contracts',
};

export function viewForAiUseCase(useCase?: string): WorkspaceView {
  if (!useCase) return 'ai';
  return USE_CASE_TO_VIEW[useCase] ?? 'ai';
}
