// Imports BadRequestError from ../../../common/errors/BadRequestError.
import { BadRequestError } from "../../../common/errors/BadRequestError";
// Imports PlanStatus from ../models/plan.model.
import { PlanStatus } from "../models/plan.model";

// Provides the next part of the surrounding operation.
const allowedTransitions: Record<PlanStatus, PlanStatus[]> = {
  // Provides the next part of the surrounding operation.
  [PlanStatus.PENDING]: [PlanStatus.ACTIVE, PlanStatus.CANCELLED],
  // Provides the next part of the surrounding operation.
  [PlanStatus.ACTIVE]: [PlanStatus.PAYMENT_DUE, PlanStatus.PAUSED, PlanStatus.SERVICE_REQUEST, PlanStatus.CANCELLED],
  // Provides the next part of the surrounding operation.
  [PlanStatus.PAYMENT_DUE]: [PlanStatus.ACTIVE, PlanStatus.OVERDUE, PlanStatus.PAUSED, PlanStatus.CANCELLED],
  // Provides the next part of the surrounding operation.
  [PlanStatus.OVERDUE]: [PlanStatus.ACTIVE, PlanStatus.PAUSED, PlanStatus.CANCELLED, PlanStatus.EXPIRED],
  // Provides the next part of the surrounding operation.
  [PlanStatus.PAUSED]: [PlanStatus.ACTIVE, PlanStatus.CANCELLED],
  // Provides the next part of the surrounding operation.
  [PlanStatus.SERVICE_REQUEST]: [PlanStatus.UNDER_REVIEW, PlanStatus.CANCELLED],
  // Provides the next part of the surrounding operation.
  [PlanStatus.UNDER_REVIEW]: [PlanStatus.APPROVED, PlanStatus.CANCELLED],
  // Provides the next part of the surrounding operation.
  [PlanStatus.APPROVED]: [PlanStatus.SERVICE_SCHEDULED, PlanStatus.CANCELLED],
  // Provides the next part of the surrounding operation.
  [PlanStatus.SERVICE_SCHEDULED]: [PlanStatus.COMPLETED, PlanStatus.CANCELLED],
  // Provides the next part of the surrounding operation.
  [PlanStatus.COMPLETED]: [],
  // Provides the next part of the surrounding operation.
  [PlanStatus.CANCELLED]: [],
  // Provides the next part of the surrounding operation.
  [PlanStatus.EXPIRED]: [],
// Closes the current block.
};

// Declares the service class that groups related application operations.
export class PlanStateService {
  // Checks whether the requested state transition is allowed.
  // Calls assertTransition to perform the next step.
  assertTransition(from: PlanStatus, to: PlanStatus): void {
    // Runs the following branch when !allowedTransitions[from]?.includes(to) is true.
    if (!allowedTransitions[from]?.includes(to)) {
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError(`Plan cannot transition from ${from} to ${to}`);
    // Closes the current block.
    }
  // Closes the current block.
  }
// Closes the current block.
}
