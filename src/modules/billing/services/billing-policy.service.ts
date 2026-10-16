// Imports env from ../../../config/application.
import { env } from "../../../config/application";
// Imports BadRequestError from ../../../common/errors/BadRequestError.
import { BadRequestError } from "../../../common/errors/BadRequestError";

// Declares a type used to describe this service data.
export interface BillingPolicy {
  // Declares the configured property with type or value boolean.
  configured: boolean;
  // Declares the gracePeriodDays property with type or value number.
  gracePeriodDays: number;
  // Declares the retryIntervalDays property with type or value number[].
  retryIntervalDays: number[];
  // Declares the maxRetryAttempts property with type or value number.
  maxRetryAttempts: number;
  // Declares the continueBillingWhileOverdue property with type or value boolean.
  continueBillingWhileOverdue: boolean;
// Closes the current block.
}

// Declares the service class that groups related application operations.
export class BillingPolicyService {
  // Returns the requested value or record.
  // Calls getPolicy to perform the next step.
  getPolicy(): BillingPolicy {
    // Defines retryIntervalDays using the value on the right-hand side.
    const retryIntervalDays = env.BILLING_RETRY_INTERVAL_DAYS
      // Calls .split to perform the next step.
      .split(",")
      // Calls .map to perform the next step.
      .map((value) => Number(value.trim()))
      // Calls .filter to perform the next step.
      .filter((value) => Number.isFinite(value) && value > 0);

    // Returns { to the caller.
    return {
      // Declares the configured property with type or value env.BILLING_POLICY_CONFIGURED,.
      configured: env.BILLING_POLICY_CONFIGURED,
      // Declares the gracePeriodDays property with type or value env.BILLING_GRACE_PERIOD_DAYS,.
      gracePeriodDays: env.BILLING_GRACE_PERIOD_DAYS,
      // Provides the next part of the surrounding operation.
      retryIntervalDays,
      // Declares the maxRetryAttempts property with type or value env.BILLING_MAX_RETRY_ATTEMPTS,.
      maxRetryAttempts: env.BILLING_MAX_RETRY_ATTEMPTS,
      // Declares the continueBillingWhileOverdue property with type or value env.BILLING_CONTINUE_OVERDUE,.
      continueBillingWhileOverdue: env.BILLING_CONTINUE_OVERDUE,
    // Closes the current block.
    };
  // Closes the current block.
  }

  // Checks whether recurring billing is enabled and properly configured.
  // Calls assertRunnable to perform the next step.
  assertRunnable(): BillingPolicy {
    // Stores the result of this.getPolicy in policy.
    const policy = this.getPolicy();
    // Runs the following branch when !policy.configured is true.
    if (!policy.configured) {
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError("Billing policy is not configured. Set BILLING_POLICY_CONFIGURED=true with approved grace and retry settings.");
    // Closes the current block.
    }
    // Runs the following branch when policy.gracePeriodDays <= 0 || policy.maxRetryAttempts <= 0 || policy.retryIntervalDa is true.
    if (policy.gracePeriodDays <= 0 || policy.maxRetryAttempts <= 0 || policy.retryIntervalDays.length === 0) {
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError("Billing grace period, retry intervals, and max attempts must be configured before billing can run.");
    // Closes the current block.
    }
    // Returns policy to the caller.
    return policy;
  // Closes the current block.
  }
// Closes the current block.
}
