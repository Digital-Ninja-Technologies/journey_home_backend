import { Notification, NotificationStatus } from "../models/notification.model";
import { User } from "../../auth/models/auth.model";
import { Types } from "mongoose";

export class NotificationRepository {
  recordIfNew(
    ownerId: string,
    planId: string | undefined,
    event: string,
    dedupeKey: string,
  ) {
    return Notification.updateOne(
      { dedupeKey },
      {
        $setOnInsert: {
          owner: new Types.ObjectId(ownerId),
          plan: planId ? new Types.ObjectId(planId) : undefined,
          event,
          dedupeKey,
          status: NotificationStatus.PENDING,
          channel: "email",
          subject: event,
        },
      },
      { upsert: true },
    ).exec();
  }

  findUserContact(ownerId: string) {
    return User.findById(ownerId).select("email name").lean();
  }

  setStatus(dedupeKey: string, status: NotificationStatus) {
    return Notification.updateOne({ dedupeKey }, { $set: { status } }).exec();
  }

  listForOwner(ownerId: string) {
    return Notification.find({ owner: ownerId }).sort({ createdAt: -1 }).exec();
  }
}
