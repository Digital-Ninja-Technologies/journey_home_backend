import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import { env } from "../../../config/application";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { AxiosError } from "axios";

export interface PaystackTransactionData {
  id?: number;
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  gateway_response?: string;
  customer?: { email?: string; customer_code?: string };
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

  private async request<T>(operation: string, call: () => Promise<{ data: { data: T; message?: string } }>): Promise<T> {
    try { return (await call()).data.data; }
    catch (error) {
      const ax = error as AxiosError<{ message?: string; errors?: Record<string, string[]> }>;
      const providerMessage = ax.response?.data?.message || Object.values(ax.response?.data?.errors || {}).flat()[0];
      if (ax.response) throw new BadRequestError(providerMessage ? `Paystack ${operation} failed: ${providerMessage}` : `Paystack ${operation} failed (HTTP ${ax.response.status}). Please check the payment details and try again.`);
      if (ax.code === "ECONNABORTED" || ax.code === "ETIMEDOUT") throw new BadRequestError(`Paystack ${operation} timed out. Please try again.`);
      if (ax.isAxiosError) throw new BadRequestError(`Could not reach Paystack to ${operation}. Please try again shortly.`);
      throw error;
    }
  }

  verifySignature(
    rawBody: Buffer | undefined,
    signature: string | string[] | undefined,
  ): boolean {
    if (!rawBody || !signature || Array.isArray(signature)) return false;

    const hash = crypto
      .createHmac("sha512", env.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest("hex");

    const expected = Buffer.from(hash);
    const received = Buffer.from(signature);
    return (
      expected.length === received.length &&
      crypto.timingSafeEqual(expected, received)
    );
  }

  async initializeTransaction(payload: {
    email: string;
    amount: number;
    currency: string;
    reference: string;
    metadata?: Record<string, unknown>;
    plan?: string;
  }): Promise<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }> {
    return this.request("initialize checkout", () => this.client.post("/transaction/initialize", payload));
  }

  async createPlan(payload: {
    name: string;
    amount: number;
    currency: string;
    interval: string;
    description?: string;
  }): Promise<PaystackPlanData> {
    return this.request("create a subscription plan", () => this.client.post("/plan", payload));
  }

  async fetchSubscription(code: string): Promise<PaystackSubscriptionData> {
    return this.request("retrieve subscription", () => this.client.get(`/subscription/${encodeURIComponent(code)}`));
  }

  async verifyTransaction(reference: string): Promise<PaystackTransactionData> {
    return this.request("verify transaction", () => this.client.get(`/transaction/verify/${encodeURIComponent(reference)}`));
  }
}
