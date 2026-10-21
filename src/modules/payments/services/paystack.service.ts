import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import { env } from "../../../config/application";
import { BadRequestError } from "../../../common/errors/BadRequestError";

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
    const { data } = await this.client.post("/transaction/initialize", payload);
    return data.data;
  }

  async createPlan(payload: {
    name: string;
    amount: number;
    currency: string;
    interval: string;
    description?: string;
  }): Promise<PaystackPlanData> {
    const { data } = await this.client.post("/plan", payload);
    return data.data;
  }

  async fetchSubscription(code: string): Promise<PaystackSubscriptionData> {
    const { data } = await this.client.get(
      `/subscription/${encodeURIComponent(code)}`,
    );
    return data.data;
  }

  async verifyTransaction(reference: string): Promise<PaystackTransactionData> {
    const { data } = await this.client.get(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    return data.data;
  }
}
