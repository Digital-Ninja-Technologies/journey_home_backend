import { BadRequestError } from "../../../common/errors/BadRequestError";
import { PlanStatus } from "../models/plan.model";

const allowedTransitions: Record<PlanStatus, PlanStatus[]> = {
  [PlanStatus.PENDING]: [PlanStatus.ACTIVE, PlanStatus.CANCELLED],
  [PlanStatus.ACTIVE]: [PlanStatus.PAYMENT_DUE, PlanStatus.PAUSED, PlanStatus.SERVICE_REQUEST, PlanStatus.CANCELLED],
  [PlanStatus.PAYMENT_DUE]: [PlanStatus.ACTIVE, PlanStatus.OVERDUE, PlanStatus.PAUSED, PlanStatus.CANCELLED],
  [PlanStatus.OVERDUE]: [PlanStatus.ACTIVE, PlanStatus.PAUSED, PlanStatus.CANCELLED, PlanStatus.EXPIRED],
  [PlanStatus.PAUSED]: [PlanStatus.ACTIVE, PlanStatus.CANCELLED],
  [PlanStatus.SERVICE_REQUEST]: [PlanStatus.UNDER_REVIEW, PlanStatus.CANCELLED],
  [PlanStatus.UNDER_REVIEW]: [PlanStatus.APPROVED, PlanStatus.CANCELLED],
  [PlanStatus.APPROVED]: [PlanStatus.SERVICE_SCHEDULED, PlanStatus.CANCELLED],
  [PlanStatus.SERVICE_SCHEDULED]: [PlanStatus.COMPLETED, PlanStatus.CANCELLED],
  [PlanStatus.COMPLETED]: [],
  [PlanStatus.CANCELLED]: [],
  [PlanStatus.EXPIRED]: [],
};

export class PlanStateService {
  assertTransition(from: PlanStatus, to: PlanStatus): void {
    if (!allowedTransitions[from]?.includes(to)) {
      throw new BadRequestError(`Plan cannot transition from ${from} to ${to}`);
    }
  }
}
