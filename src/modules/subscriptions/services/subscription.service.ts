import { NotFoundError } from "../../../common/errors/NotFoundError";
import { SubscriptionRepository } from "../repositories/subscription.repository";
import { ISubscription } from "../models/subscription.model";
export class SubscriptionService {
  private repository = new SubscriptionRepository();
  list(ownerId: string): Promise<ISubscription[]> {
    return this.repository.listForOwner(ownerId);
  }
  async get(id: string, ownerId: string): Promise<ISubscription> {
    const subscription = await this.repository.findByIdForOwner(id, ownerId);
    if (!subscription) throw new NotFoundError("Subscription not found");
    return subscription;
  }
}
