import { Types } from "mongoose";
import { EmailService } from "../../../common/services/email.service";
import { User } from "../../auth/models/auth.model";
import { Notification, NotificationEvent, NotificationStatus } from "../models/notification.model";

export class NotificationService {
  async record(ownerId: string, planId: string | undefined, event: NotificationEvent, dedupeKey: string): Promise<void> {
    const result = await Notification.updateOne(
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

    if (result.upsertedCount !== 1) return;

    const user = await User.findById(ownerId).select("email name").lean();
    if (!user?.email) return;
    const sent = await new EmailService().sendEmail(
      user.email,
      `Journey Home: ${event}`,
      `<p>Hello ${user.name || "there"},</p><p>${event} for your Journey Home plan.</p>`,
    );
    await Notification.updateOne(
      { dedupeKey },
      { $set: { status: sent ? NotificationStatus.SENT : NotificationStatus.FAILED } },
    ).exec();
  }
}
