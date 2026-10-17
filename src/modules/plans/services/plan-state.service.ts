import { BadRequestError } from "../../../common/errors/BadRequestError";
import { PlanStatus } from "../models/plan.model";

// Maps each current status to the statuses it can transition to.
const allowedTransitions: Record<PlanStatus, PlanStatus[]> = {
  // A pending plan can become active or be cancelled.
  [PlanStatus.PENDING]: [PlanStatus.ACTIVE, PlanStatus.CANCELLED],

  // An active plan can enter payment, pause, service, or cancellation states.
  [PlanStatus.ACTIVE]: [
    PlanStatus.PAYMENT_DUE,
    PlanStatus.PAUSED,
    PlanStatus.SERVICE_REQUEST,
    PlanStatus.CANCELLED,
  ],

  // A plan with payment due can become active, overdue, paused, or cancelled.
  [PlanStatus.PAYMENT_DUE]: [
    PlanStatus.ACTIVE,
    PlanStatus.OVERDUE,
    PlanStatus.PAUSED,
    PlanStatus.CANCELLED,
  ],

  // An overdue plan can recover, pause, cancel, or expire.
  [PlanStatus.OVERDUE]: [
    PlanStatus.ACTIVE,
    PlanStatus.PAUSED,
    PlanStatus.CANCELLED,
    PlanStatus.EXPIRED,
  ],

  // A paused plan can resume or be cancelled.
  [PlanStatus.PAUSED]: [PlanStatus.ACTIVE, PlanStatus.CANCELLED],

  // A service request can move into review or be cancelled.
  [PlanStatus.SERVICE_REQUEST]: [
    PlanStatus.UNDER_REVIEW,
    PlanStatus.CANCELLED,
  ],

  // A reviewed request can be approved or cancelled.
  [PlanStatus.UNDER_REVIEW]: [
    PlanStatus.APPROVED,
    PlanStatus.CANCELLED,
  ],

  // An approved request can be scheduled for service or cancelled.
  [PlanStatus.APPROVED]: [
    PlanStatus.SERVICE_SCHEDULED,
    PlanStatus.CANCELLED,
  ],

  // Scheduled service can be completed or cancelled.
  [PlanStatus.SERVICE_SCHEDULED]: [
    PlanStatus.COMPLETED,
    PlanStatus.CANCELLED,
  ],

  // Terminal states: no further transitions are allowed.
  [PlanStatus.COMPLETED]: [],
  [PlanStatus.CANCELLED]: [],
  [PlanStatus.EXPIRED]: [],
};

export class PlanStateService {
  // Throws an error if the requested transition is not allowed.
  assertTransition(from: PlanStatus, to: PlanStatus): void {
    // Get the allowed destinations and check whether "to" is one of them.
    if (!allowedTransitions[from]?.includes(to)) {
      // Reject the invalid transition with a descriptive error.
      throw new BadRequestError(
        `Plan cannot transition from ${from} to ${to}`
      );
    }
  }
}
