import { EmailService } from "../../../common/services/email.service";
import {
  NotificationEvent,
  NotificationStatus,
} from "../models/notification.model";
import { NotificationRepository } from "../repositories/notification.repository";

export class NotificationService {
  private repository = new NotificationRepository();
  async record(
    ownerId: string,
    planId: string | undefined,
    event: NotificationEvent,
    dedupeKey: string,
  ): Promise<void> {
    const result = await this.repository.recordIfNew(
      ownerId,
      planId,
      event,
      dedupeKey,
    );

    if (result.upsertedCount !== 1) return;

    const user = await this.repository.findUserContact(ownerId);
    if (!user?.email) return;

    const sent = await new EmailService().sendEmail(
      user.email,
      `Journey Home: ${event}`,
      `<p>Hello ${user.name || "there"},</p><p>${event} for your Journey Home plan.</p>`,
    );

    await this.repository.setStatus(
      dedupeKey,
      sent ? NotificationStatus.SENT : NotificationStatus.FAILED,
    );
  }

  async listForOwner(userId: string) {
    const notifications = await this.repository.listForOwner(userId);

    return notifications
  }
}
