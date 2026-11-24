import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import { env } from "../../../config/application";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { AppError } from "../../../common/errors/AppError";
import { AxiosError } from "axios";
import { logger } from "../../../common/logger/logger";

export interface PaystackTransactionData {
  id?: number;
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  gateway_response?: string;
  customer?: { email?: string; customer_code?: string };
  paid_at?: string;
  created_at?: string;
  next_payment_date?: string;
  subscription_code?: string;
  plan?: { plan_code?: string } | number;
  metadata?: Record<string, unknown>;
}

export interface PaystackPlanData {
  id: number;
  plan_code: string;
  amount: number;
  currency: string;
  interval: string;
}
export interface PaystackSubscriptionData {
  subscription_code: string;
  status: string;
  customer?: { customer_code?: string; email?: string } | number;
  plan?: { plan_code?: string } | number;
  next_payment_date?: string;
  createdAt?: string;
}

export class PaystackService {
  private client: AxiosInstance;

  constructor() {
    if (!env.PAYSTACK_SECRET_KEY) {
      throw new BadRequestError(
        "PAYSTACK_SECRET_KEY is required for Paystack operations",
      );
    }
    this.client = axios.create({
      baseURL: env.PAYSTACK_BASE_URL,
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 20000,
    });
  }

  private async request<T>(
    operation: string,
    call: () => Promise<{ data: { data: T; message?: string } }>,
  ): Promise<T> {
    try {
      return (await call()).data.data;
    } catch (error) {
      const ax = error as AxiosError<{
        message?: string;
        errors?: Record<string, string[]>;
      }>;
      const providerMessage =
        ax.response?.data?.message ||
        Object.values(ax.response?.data?.errors || {}).flat()[0];
      if (ax.response) {
        const providerStatus = ax.response.status;
        const status = providerStatus === 429 ? 503 : providerStatus === 401 || providerStatus === 403 || providerStatus >= 500 ? 502 : 400;
        throw new AppError(
          providerMessage
            ? `Paystack ${operation} failed: ${providerMessage}`
            : `Paystack ${operation} failed (HTTP ${ax.response.status}).`,
          status,
        );
      }
      if (ax.code === "ECONNABORTED" || ax.code === "ETIMEDOUT")
        throw new AppError(
          `Paystack ${operation} timed out. Please try again.`,
          503,
        );
      if (ax.isAxiosError)
        throw new AppError(
          `Could not reach Paystack to ${operation}. Please try again shortly.`,
          503,
        );
      throw error;
    }
  }

  verifySignature(
    rawBody: Buffer | undefined,
    legacySignature: string | string[] | undefined,
    timestampedSignature?: string | string[] | undefined,
  ): boolean {
    if (!rawBody) {
      logger.warn("WEBHOOK_SIG: No raw body available for signature verification");
      return false;
    }
    const secureEquals = (expectedHex: string, receivedHex: string) => {
      if (!/^[a-f0-9]{128}$/i.test(receivedHex)) return false;
      const expected = Buffer.from(expectedHex, "hex");
      const received = Buffer.from(receivedHex, "hex");
      return expected.length === received.length && crypto.timingSafeEqual(expected, received);
    };

    if (typeof legacySignature === "string" && env.PAYSTACK_SECRET_KEY) {
      const expected = crypto.createHmac("sha512", env.PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
      if (secureEquals(expected, legacySignature)) {
        logger.info("WEBHOOK_SIG: Legacy signature verified successfully");
        return true;
      }
      logger.warn("WEBHOOK_SIG: Legacy signature did not match");
    }

    if (typeof timestampedSignature !== "string") {
      logger.warn(
        {
          hasLegacySig: typeof legacySignature === "string",
          hasTimestampedSig: false,
          hasSecretKey: !!env.PAYSTACK_SECRET_KEY,
          rawBodyLength: rawBody.length,
        },
        "WEBHOOK_SIG_FAILED: No valid signature header matched",
      );
      return false;
    }
    const fields = timestampedSignature.split(",").map((part) => part.trim());
    const timestamp = fields.map((part) => /^t=(\d+)$/.exec(part)).find(Boolean)?.[1];
    if (!timestamp) {
      logger.warn("WEBHOOK_SIG_FAILED: Timestamped signature has no t= field");
      return false;
    }
    const timestampSeconds = Number(timestamp);
    const tolerance = env.PAYSTACK_WEBHOOK_TOLERANCE_SECONDS;
    if (!Number.isSafeInteger(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > tolerance) {
      logger.warn(
        { timestampSeconds, tolerance, drift: Math.abs(Date.now() / 1000 - timestampSeconds) },
        "WEBHOOK_SIG_FAILED: Timestamped signature outside tolerance window",
      );
      return false;
    }

    const signatures = fields.flatMap((part) => {
      const match = /^v1=(?:(whk_[^:]+):)?([a-f0-9]{128})$/i.exec(part);
      return match ? [{ keyId: match[1], signature: match[2] }] : [];
    });
    const configured = env.PAYSTACK_WEBHOOK_SECRETS.split(",").map((entry) => {
      const separator = entry.indexOf("=");
      return separator > 0
        ? { keyId: entry.slice(0, separator).trim(), secret: entry.slice(separator + 1).trim() }
        : { keyId: undefined, secret: entry.trim() };
    }).filter((entry) => entry.secret);

    const matched = signatures.some(({ keyId, signature }) => configured.some(({ keyId: configuredId, secret }) => {
      if (keyId && configuredId && keyId !== configuredId) return false;
      const expected = crypto.createHmac("sha512", secret).update(`${timestamp}.`).update(rawBody).digest("hex");
      return secureEquals(expected, signature);
    }));

    if (!matched) {
      logger.warn(
        {
          signatureCount: signatures.length,
          configuredCount: configured.length,
          hasWebhookSecrets: !!env.PAYSTACK_WEBHOOK_SECRETS,
        },
        "WEBHOOK_SIG_FAILED: No timestamped signature matched any configured secret",
      );
    } else {
      logger.info("WEBHOOK_SIG: Timestamped signature verified successfully");
    }
    return matched;
  }

  async initializeTransaction(payload: {
    email: string;
    amount: number;
    currency: string;
    reference: string;
    callback_url: string;
    metadata?: Record<string, unknown>;
    plan: string;
  }): Promise<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }> {
    return this.request("initialize checkout", () =>
      this.client.post("/transaction/initialize", payload),
    );
  }

  async createPlan(payload: {
    name: string;
    amount: number;
    currency: string;
    interval: string;
    description?: string;
  }): Promise<PaystackPlanData> {
    return this.request("create a subscription plan", () =>
      this.client.post("/plan", payload),
    );
  }

  async updatePlan(
    planCode: string,
    payload: {
      name: string;
      amount: number;
      currency: string;
      interval: string;
      description?: string;
      update_existing_subscriptions: false;
    },
  ): Promise<void> {
    // Paystack's update endpoint may return only a message, so it has no plan data to deserialize.
    await this.request<unknown>(`update subscription plan ${planCode}`, () =>
      this.client.put(`/plan/${encodeURIComponent(planCode)}`, payload),
    );
  }

  async fetchSubscription(code: string): Promise<PaystackSubscriptionData> {
    return this.request("retrieve subscription", () =>
      this.client.get(`/subscription/${encodeURIComponent(code)}`),
    );
  }

  async verifyTransaction(reference: string): Promise<PaystackTransactionData> {
    return this.request("verify transaction", () =>
      this.client.get(`/transaction/verify/${encodeURIComponent(reference)}`),
    );
  }
}
