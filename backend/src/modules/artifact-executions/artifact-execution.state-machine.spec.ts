import { BusinessException } from '../../exceptions';
import { ArtifactExecutionStateMachine } from './artifact-execution.state-machine';

describe('ArtifactExecutionStateMachine', () => {
  const machine = new ArtifactExecutionStateMachine();
  it('accepts the operational review path', () => {
    expect(() =>
      machine.assertTransition('IN_PROGRESS', 'UNDER_REVIEW'),
    ).not.toThrow();
    expect(() =>
      machine.assertTransition('UNDER_REVIEW', 'APPROVED'),
    ).not.toThrow();
    expect(() =>
      machine.assertTransition('APPROVED', 'COMPLETED'),
    ).not.toThrow();
  });
  it('rejects skipping authoritative states', () => {
    expect(() => machine.assertTransition('DRAFT', 'COMPLETED')).toThrow(
      BusinessException,
    );
  });
});
