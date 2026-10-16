// Imports EmailService from ../../../common/services/email.service.
import { EmailService } from "../../../common/services/email.service";
// Provides the next part of the surrounding operation.
import {
  // Provides the next part of the surrounding operation.
  NotificationEvent,
  // Provides the next part of the surrounding operation.
  NotificationStatus,
// Closes the current block.
} from "../models/notification.model";
// Imports NotificationRepository from ../repositories/notification.repository.
import { NotificationRepository } from "../repositories/notification.repository";

// Declares the service class that groups related application operations.
export class NotificationService {
  // Provides the next part of the surrounding operation.
  private repository = new NotificationRepository();
  // Stores the audit or notification record and performs related follow-up work.
  // Declares a function or method used by this service.
  async record(
    // Declares the ownerId property with type or value string,.
    ownerId: string,
    // Declares the planId property with type or value string | undefined,.
    planId: string | undefined,
    // Declares the event property with type or value NotificationEvent,.
    event: NotificationEvent,
    // Declares the dedupeKey property with type or value string,.
    dedupeKey: string,
  // Provides the next part of the surrounding operation.
  ): Promise<void> {

    // Stores the result of this.repository.recordIfNew in result.
    const result = await this.repository.recordIfNew(
      // Provides the next part of the surrounding operation.
      ownerId,
      // Provides the next part of the surrounding operation.
      planId,
      // Provides the next part of the surrounding operation.
      event,
      // Provides the next part of the surrounding operation.
      dedupeKey,
    // Provides the next part of the surrounding operation.
    );

    // Runs the following branch when result.upsertedCount !== 1 is true.
    if (result.upsertedCount !== 1) return;

    // Stores the result of this.repository.findUserContact in user.
    const user = await this.repository.findUserContact(ownerId);
    // Runs the following branch when !user?.email is true.
    if (!user?.email) return;
    // Stores the result of EmailService in sent.
    const sent = await new EmailService().sendEmail(
      // Provides the next part of the surrounding operation.
      user.email,
      // Provides the next part of the surrounding operation.
      `Journey Home: ${event}`,
      // Provides the next part of the surrounding operation.
      `<p>Hello ${user.name || "there"},</p><p>${event} for your Journey Home plan.</p>`,
    // Provides the next part of the surrounding operation.
    );
    
    // Waits for repository.setStatus to finish before continuing.
    await this.repository.setStatus(
      // Provides the next part of the surrounding operation.
      dedupeKey,
      // Provides the next part of the surrounding operation.
      sent ? NotificationStatus.SENT : NotificationStatus.FAILED,
    // Provides the next part of the surrounding operation.
    );
  // Closes the current block.
  }
// Closes the current block.
}
