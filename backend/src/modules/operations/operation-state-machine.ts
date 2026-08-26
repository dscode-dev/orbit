import {
  OperationStatus,
  type OperationStatus as OperationStatusType,
} from '../../contracts';

const TRANSITIONS: Readonly<
  Record<OperationStatusType, readonly OperationStatusType[]>
> = {
  OPEN: [
    OperationStatus.SCHEDULED,
    OperationStatus.IN_PROGRESS,
    OperationStatus.CANCELLED,
  ],
  SCHEDULED: [
    OperationStatus.OPEN,
    OperationStatus.IN_PROGRESS,
    OperationStatus.CANCELLED,
  ],
  IN_PROGRESS: [
    OperationStatus.PAUSED,
    OperationStatus.COMPLETED,
    OperationStatus.CANCELLED,
  ],
  PAUSED: [OperationStatus.IN_PROGRESS, OperationStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [OperationStatus.OPEN],
};

export const OperationStateMachine = {
  allowedTransitions(
    status: OperationStatusType,
  ): readonly OperationStatusType[] {
    return TRANSITIONS[status] ?? [];
  },
  allows(from: OperationStatusType, to: OperationStatusType): boolean {
    return (TRANSITIONS[from] ?? []).includes(to);
  },
};
