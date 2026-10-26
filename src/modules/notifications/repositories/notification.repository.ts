import { Types } from "mongoose";
import { PageOptions, escapeRegex } from "../../../common/utils/pagination";
import { User } from "../../auth/models/auth.model";
import {
  INotification,
  Notification,
  NotificationEvent,
} from "../models/notification.model";

export interface NotificationFilters {
  title?: string;
  isRead?: boolean;
  from?: Date;
  to?: Date;
}

export class NotificationRepository {
  findUserContact(userId: string) {
    return User.findById(userId).select("email name").lean();
  }

  findByDedupeKey(dedupeKey: string) {
    return Notification.exists({ dedupeKey }).exec();
  }

  createInApp(data: {
    userId: string;
    title: string;
    message: string;
    event: NotificationEvent;
    dedupeKey: string;
  }): Promise<INotification> {
    return Notification.findOneAndUpdate(
      { dedupeKey: data.dedupeKey },
      {
        $setOnInsert: {
          ...data,
          userId: new Types.ObjectId(data.userId),
          channel: "in_app",
          isRead: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec() as Promise<INotification>;
  }

  async listForOwner(
    userId: string,
    options: PageOptions,
    filters: NotificationFilters,
  ) {
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };
    if (filters.title)
      query.title = { $regex: escapeRegex(filters.title), $options: "i" };
    if (filters.isRead !== undefined) query.isRead = filters.isRead;
    if (filters.from || filters.to) {
      query.createdAt = {
        ...(filters.from ? { $gte: filters.from } : {}),
        ...(filters.to ? { $lte: filters.to } : {}),
      };
    }
    const ownerQuery = { userId: new Types.ObjectId(userId) };
    const [items, filteredTotal, totalNotifications, totalUnreadNotifications] =
      await Promise.all([
        Notification.find(query)
          .sort({ createdAt: -1 })
          .skip(options.skip)
          .limit(options.limit)
          .exec(),
        Notification.countDocuments(query).exec(),
        Notification.countDocuments(ownerQuery).exec(),
        Notification.countDocuments({ ...ownerQuery, isRead: false }).exec(),
      ]);
    return {
      items,
      filteredTotal,
      totalNotifications,
      totalUnreadNotifications,
    };
  }

  markReadForOwner(id: string, userId: string) {
    return Notification.findOneAndUpdate(
      { _id: id, userId: new Types.ObjectId(userId) },
      { $set: { isRead: true } },
      { new: true },
    ).exec();
  }

  deleteForOwner(id: string, userId: string) {
    return Notification.findOneAndDelete({
      _id: id,
      userId: new Types.ObjectId(userId),
    }).exec();
  }
}
