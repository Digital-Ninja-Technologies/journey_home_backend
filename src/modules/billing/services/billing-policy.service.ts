import { env } from "../../../config/application";
import { BadRequestError } from "../../../common/errors/BadRequestError";

export interface BillingPolicy {
  configured: boolean;
  gracePeriodDays: number;
  retryIntervalDays: number[];
  maxRetryAttempts: number;
  continueBillingWhileOverdue: boolean;
}

export class BillingPolicyService {
  getPolicy(): BillingPolicy {
    const retryIntervalDays = env.BILLING_RETRY_INTERVAL_DAYS
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);

    return {
      configured: env.BILLING_POLICY_CONFIGURED,
      gracePeriodDays: env.BILLING_GRACE_PERIOD_DAYS,
      retryIntervalDays,
      maxRetryAttempts: env.BILLING_MAX_RETRY_ATTEMPTS,
      continueBillingWhileOverdue: env.BILLING_CONTINUE_OVERDUE,
    };
  }

  assertRunnable(): BillingPolicy {
    const policy = this.getPolicy();
    if (!policy.configured) {
      throw new BadRequestError("Billing policy is not configured. Set BILLING_POLICY_CONFIGURED=true with approved grace and retry settings.");
    }
    if (policy.gracePeriodDays <= 0 || policy.maxRetryAttempts <= 0 || policy.retryIntervalDays.length === 0) {
      throw new BadRequestError("Billing grace period, retry intervals, and max attempts must be configured before billing can run.");
    }
    return policy;
  }
}
