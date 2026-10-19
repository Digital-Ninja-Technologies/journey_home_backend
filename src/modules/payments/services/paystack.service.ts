import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import { env } from "../../../config/application";
import { BadRequestError } from "../../../common/errors/BadRequestError";

export interface PaystackAuthorizationData {
  authorization_code?: string;
  reusable?: boolean;
  channel?: string;
  card_type?: string;
  bank?: string;
  last4?: string;
  exp_month?: string;
  exp_year?: string;
}

export interface PaystackTransactionData {
  id?: number;
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  gateway_response?: string;
  authorization?: PaystackAuthorizationData;
  customer?: { email?: string; customer_code?: string };
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

    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  }

  async initializeTransaction(payload: {
    email: string;
    amount: number;
    currency: string;
    reference: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }> {
    const { data } = await this.client.post("/transaction/initialize", payload);
    return data.data;
  }

  async verifyTransaction(reference: string): Promise<PaystackTransactionData> {
    const { data } = await this.client.get(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    return data.data;
  }

  async chargeAuthorization(payload: {
    email: string;
    amount: number;
    currency: string;
    authorization_code: string;
    reference: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaystackTransactionData> {
    const { data } = await this.client.post(
      "/transaction/charge_authorization",
      payload,
    );
    return data.data;
  }
}
