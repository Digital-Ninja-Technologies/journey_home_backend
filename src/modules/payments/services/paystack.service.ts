// Imports axios from axios.
import axios, { AxiosInstance } from "axios";
// Imports crypto from crypto.
import crypto from "crypto";
// Imports env from ../../../config/application.
import { env } from "../../../config/application";
// Imports BadRequestError from ../../../common/errors/BadRequestError.
import { BadRequestError } from "../../../common/errors/BadRequestError";

// Declares a type used to describe this service data.
export interface PaystackAuthorizationData {
  // Declares the authorization_code property with type or value string.
  authorization_code?: string;
  // Declares the reusable property with type or value boolean.
  reusable?: boolean;
  // Declares the channel property with type or value string.
  channel?: string;
  // Declares the card_type property with type or value string.
  card_type?: string;
  // Declares the bank property with type or value string.
  bank?: string;
  // Declares the last4 property with type or value string.
  last4?: string;
  // Declares the exp_month property with type or value string.
  exp_month?: string;
  // Declares the exp_year property with type or value string.
  exp_year?: string;
// Closes the current block.
}

// Declares a type used to describe this service data.
export interface PaystackTransactionData {
  // Declares the id property with type or value number.
  id?: number;
  // Declares the status property with type or value string.
  status?: string;
  // Declares the reference property with type or value string.
  reference?: string;
  // Declares the amount property with type or value number.
  amount?: number;
  // Declares the currency property with type or value string.
  currency?: string;
  // Declares the gateway_response property with type or value string.
  gateway_response?: string;
  // Declares the authorization property with type or value PaystackAuthorizationData.
  authorization?: PaystackAuthorizationData;
  // Declares the customer property with type or value { email?: string; customer_code?: string }.
  customer?: { email?: string; customer_code?: string };
// Closes the current block.
}

// Declares the service class that groups related application operations.
export class PaystackService {
  // Provides the next part of the surrounding operation.
  private client: AxiosInstance;

  // Initializes the service and its dependencies.
  // Calls constructor to perform the next step.
  constructor() {
    // Runs the following branch when !env.PAYSTACK_SECRET_KEY is true.
    if (!env.PAYSTACK_SECRET_KEY) {
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError("PAYSTACK_SECRET_KEY is required for Paystack operations");
    // Closes the current block.
    }
    // Updates client with the value on the right-hand side.
    this.client = axios.create({
      // Declares the baseURL property with type or value env.PAYSTACK_BASE_URL,.
      baseURL: env.PAYSTACK_BASE_URL,
      // Declares the headers property with type or value {.
      headers: {
        // Declares the Authorization property with type or value `Bearer ${env.PAYSTACK_SECRET_KEY}`,.
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        // Provides the next part of the surrounding operation.
        "Content-Type": "application/json",
      // Closes the current block.
      },
      // Declares the timeout property with type or value 20000,.
      timeout: 20000,
    // Closes the current block.
    });
  // Closes the current block.
  }

  // Checks whether the provider signature matches the request body.
  // Calls verifySignature to perform the next step.
  verifySignature(rawBody: Buffer | undefined, signature: string | string[] | undefined): boolean {
    // Runs the following branch when !rawBody || !signature || Array.isArray(signature) is true.
    if (!rawBody || !signature || Array.isArray(signature)) return false;
    // Stores the result of crypto.createHmac in hash.
    const hash = crypto.createHmac("sha512", env.PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
    // Returns crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature)) to the caller.
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  // Closes the current block.
  }

  // Starts a transaction with the payment provider.
  // Declares a function or method used by this service.
  async initializeTransaction(payload: {
    // Declares the email property with type or value string.
    email: string;
    // Declares the amount property with type or value number.
    amount: number;
    // Declares the currency property with type or value string.
    currency: string;
    // Declares the reference property with type or value string.
    reference: string;
    // Declares the callback_url property with type or value string.
    callback_url?: string;
    // Declares the metadata property with type or value Record<string, unknown>.
    metadata?: Record<string, unknown>;
  // Closes the current block.
  }): Promise<{ authorization_url: string; access_code: string; reference: string }> {
    // Provides the next part of the surrounding operation.
    const { data } = await this.client.post("/transaction/initialize", payload);
    // Returns data.data to the caller.
    return data.data;
  // Closes the current block.
  }

  // Fetches and validates a transaction with the payment provider.
  // Declares a function or method used by this service.
  async verifyTransaction(reference: string): Promise<PaystackTransactionData> {
    // Provides the next part of the surrounding operation.
    const { data } = await this.client.get(`/transaction/verify/${encodeURIComponent(reference)}`);
    // Returns data.data to the caller.
    return data.data;
  // Closes the current block.
  }

  // Charges a reusable payment authorization.
  // Declares a function or method used by this service.
  async chargeAuthorization(payload: {
    // Declares the email property with type or value string.
    email: string;
    // Declares the amount property with type or value number.
    amount: number;
    // Declares the currency property with type or value string.
    currency: string;
    // Declares the authorization_code property with type or value string.
    authorization_code: string;
    // Declares the reference property with type or value string.
    reference: string;
    // Declares the metadata property with type or value Record<string, unknown>.
    metadata?: Record<string, unknown>;
  // Closes the current block.
  }): Promise<PaystackTransactionData> {
    // Provides the next part of the surrounding operation.
    const { data } = await this.client.post("/transaction/charge_authorization", payload);
    // Returns data.data to the caller.
    return data.data;
  // Closes the current block.
  }
// Closes the current block.
}
