import { EmailService } from "../../../common/services/email.service";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { NotFoundError } from "../../../common/errors/NotFoundError";
import {
  PageOptions,
  pageResult,
  PaginatedResult,
} from "../../../common/utils/pagination";
import { Types } from "mongoose";
import { notificationEmailTemplate } from "../../auth/templates/notification-email.template";
import { NotificationEvent, INotification } from "../models/notification.model";
import {
  NotificationFilters,
  NotificationRepository,
} from "../repositories/notification.repository";

export interface NotificationContent {
  userId: string;
  event: NotificationEvent;
  dedupeKey: string;
  title?: string;
  message?: string;
  emailHtml?: string;
}

export interface NotificationListResult extends PaginatedResult<INotification> {
  counts: { totalNotifications: number; totalUnreadNotifications: number };
}

const eventCopy: Record<NotificationEvent, { title: string; message: string }> =
  {
    [NotificationEvent.PLAN_CREATED]: {
      title: "Plan created",
      message: "Your plan has been created and is ready for the next step.",
    },
    [NotificationEvent.INITIAL_PAYMENT_SUCCESS]: {
      title: "Initial payment confirmed",
      message:
        "Your initial plan contribution was confirmed and coverage is now active.",
    },
    [NotificationEvent.INITIAL_PAYMENT_FAILURE]: {
      title: "Initial payment not completed",
      message:
        "We could not confirm your initial plan contribution. Please review the payment status and try again.",
    },
    [NotificationEvent.RECURRING_PAYMENT_SUCCESS]: {
      title: "Contribution received",
      message: "Your scheduled plan contribution was received successfully.",
    },
    [NotificationEvent.RECURRING_PAYMENT_FAILURE]: {
      title: "Contribution could not be collected",
      message:
        "Paystack could not collect your scheduled contribution. Please check your payment method or contact support.",
    },
    [NotificationEvent.UPCOMING_CONTRIBUTION]: {
      title: "Upcoming contribution",
      message:
        "Your next plan contribution is coming up. Paystack will handle the collection on the scheduled date.",
    },
    [NotificationEvent.GRACE_PERIOD_STARTED]: {
      title: "Payment support period started",
      message:
        "A payment support period has started for your plan. Please review your account or contact support for help.",
    },
    [NotificationEvent.PAYMENT_OVERDUE]: {
      title: "Plan payment needs attention",
      message:
        "A plan contribution is overdue. Please review your payment status or contact support.",
    },
    [NotificationEvent.PAYMENT_RECOVERY_SUCCESS]: {
      title: "Plan payments are up to date",
      message:
        "A contribution was received and your plan payment status has been updated.",
    },
    [NotificationEvent.SERVICE_REQUEST_RECEIVED]: {
      title: "Service request received",
      message:
        "We received your service request. Our team will review the details and documents.",
    },
    [NotificationEvent.SERVICE_DOCUMENTS_APPROVED]: {
      title: "Documents approved",
      message:
        "The documents for your service request have been reviewed and approved.",
    },
    [NotificationEvent.SERVICE_DOCUMENTS_REJECTED]: {
      title: "Document update needed",
      message:
        "One or more documents need to be replaced. Please review the request details and upload a clearer or correct document.",
    },
    [NotificationEvent.SERVICE_REQUEST_APPROVED]: {
      title: "Service request approved",
      message:
        "Your service request has been approved. Our team will share the next steps with you.",
    },
    [NotificationEvent.SERVICE_REQUEST_REJECTED]: {
      title: "Service request declined",
      message:
        "Your service request was declined. Review the reason in your request details or contact support.",
    },
    [NotificationEvent.SERVICE_MORE_INFO_REQUIRED]: {
      title: "More information required",
      message:
        "Our team needs additional information before continuing with your service request. Review the request for details.",
    },
    [NotificationEvent.SERVICE_PROVIDER_ASSIGNED]: {
      title: "Service provider assigned",
      message:
        "A provider has been assigned to your service request. We will share relevant service details with you.",
    },
    [NotificationEvent.SERVICE_SCHEDULED]: {
      title: "Service scheduled",
      message:
        "Your requested service has been scheduled. Review your request for the confirmed details.",
    },
    [NotificationEvent.SERVICE_COMPLETED]: {
      title: "Service completed",
      message:
        "Your requested service has been marked complete. Contact support if you need any follow-up.",
    },
    [NotificationEvent.PRODUCT_NEWS_OFFERS]: { title: "Product news and offers", message: "See the latest Journey Home packages and features." },
  };

export class NotificationService {
  private repository = new NotificationRepository();

  async sendEmailNotification(content: NotificationContent): Promise<boolean> {
    const user = await this.repository.findUserContact(content.userId);
    if (!user?.email) return false;
    const preferenceRecord = await this.repository.getUserPreferences(content.userId);
    const prefs = preferenceRecord?.notificationPreferences;
    const paymentEvents = [NotificationEvent.UPCOMING_CONTRIBUTION, NotificationEvent.INITIAL_PAYMENT_SUCCESS, NotificationEvent.INITIAL_PAYMENT_FAILURE, NotificationEvent.RECURRING_PAYMENT_SUCCESS, NotificationEvent.RECURRING_PAYMENT_FAILURE, NotificationEvent.PAYMENT_OVERDUE, NotificationEvent.GRACE_PERIOD_STARTED, NotificationEvent.PAYMENT_RECOVERY_SUCCESS];
    const serviceEvents = Object.values(NotificationEvent).filter(event => event.startsWith("Service"));
    if (prefs && ((paymentEvents.includes(content.event) && !prefs.paymentReminders) || (content.event === NotificationEvent.PAYMENT_OVERDUE && !prefs.deficitAlerts) || (serviceEvents.includes(content.event) && !prefs.serviceRequestUpdates) || (content.event === NotificationEvent.PRODUCT_NEWS_OFFERS && !prefs.productNewsOffers))) return false;
    const { title, message } = this.resolveContent(content);
    return new EmailService().sendEmail(
      user.email,
      `Journey Home: ${title}`,
      content.emailHtml ||
        notificationEmailTemplate({
          name: user.name || "there",
          title,
          message,
        }),
    );
  }

  async createInAppNotification(
    content: NotificationContent,
  ): Promise<INotification> {
    const { title, message } = this.resolveContent(content);
    return this.repository.createInApp({
      userId: content.userId,
      event: content.event,
      dedupeKey: content.dedupeKey,
      title,
      message,
    });
  }

  /** Sends email first (without persisting an email record), then creates the durable in-app notification. */
  async notifyUser(content: NotificationContent): Promise<INotification> {
    const existing = await this.repository.findByDedupeKey(content.dedupeKey);
    if (existing) {
      return this.createInAppNotification(content);
    }
    await this.sendEmailNotification(content);
    return this.createInAppNotification(content);
  }

  async listForOwner(
    userId: string,
    options: PageOptions,
    filters: NotificationFilters,
  ): Promise<NotificationListResult> {
    const result = await this.repository.listForOwner(userId, options, filters);
    return {
      ...pageResult(result.items, result.filteredTotal, options),
      counts: {
        totalNotifications: result.totalNotifications,
        totalUnreadNotifications: result.totalUnreadNotifications,
      },
    };
  }

  async markRead(id: string, userId: string): Promise<INotification | null> {

    if (!Types.ObjectId.isValid(id))
      throw new BadRequestError("Invalid notification id");

    const notification = await this.repository.markReadForOwner(id, userId);

    if (!notification) throw new NotFoundError("Notification not found");

    return notification;
  }

  async delete(id: string, userId: string): Promise<INotification | null> {

    if (!Types.ObjectId.isValid(id))

      throw new BadRequestError("Invalid notification id");
    
    const notification = await this.repository.deleteForOwner(id, userId);

    if (!notification) throw new NotFoundError("Notification not found");
    
    return notification;
  }

  private resolveContent(content: NotificationContent): {
    title: string;
    message: string;
  } {
    const defaults = eventCopy[content.event];
    return {
      title: content.title?.trim() || defaults.title,
      message: content.message?.trim() || defaults.message,
    };
  }
}
