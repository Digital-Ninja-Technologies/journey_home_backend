import { Resend } from "resend";
import { env } from "../../config/application";
import { User, UserRole } from "../../modules/auth/models/auth.model";
import { logger } from "../logger/logger";
import { adminEnquiryTemplate, BasicEnquiry } from "../../modules/auth/templates/admin-enquiry.template";

export class EmailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(env.RESEND_API_KEY);
  }

  // Sends an email using Resend.
  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      if (!env.RESEND_API_KEY) {
        logger.warn({ to, subject }, "RESEND_API_KEY is not configured; email not sent");
        return false;
      }

      const { data, error } = await this.resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to,
        subject,
        html,
      });

      if (error) {
        logger.error(
          { err: error.message || error, to, subject },
          "Failed to send email"
        );
        return false;
      }

      logger.info({ id: data?.id, to, subject }, "Email sent successfully");
      return true;
    } catch (error: unknown) {
      logger.error(
        { err: error instanceof Error ? error.message : String(error), to, subject },
        "Failed to send email"
      );
      return false;
    }
  }

  // Sends an enquiry notification to the super administrators.
  async notifySuperAdminsOfEnquiry(enquiry: BasicEnquiry): Promise<void> {
    try {
      // Get Super Admin emails from Database
      const superAdmins = await User.find({
        $or: [{ role: UserRole.SUPER_ADMIN }, { isSuperAdmin: true }],
      })
        .select("email")
        .lean();

      const recipientEmails = new Set<string>();

      superAdmins.forEach((user) => {
        if (user.email && user.email.trim()) {
          recipientEmails.add(user.email.trim().toLowerCase());
        }
      });

      // Add .env fallback email if provided
      if (env.SUPER_ADMIN_EMAIL && env.SUPER_ADMIN_EMAIL.trim()) {
        recipientEmails.add(env.SUPER_ADMIN_EMAIL.trim().toLowerCase());
      }

      if (recipientEmails.size === 0) {
        logger.warn("No Super Admin email recipients found");
        return;
      }

      // Compile HTML template
      const subject = `[Journey Home] New ${(enquiry.type || "general").toUpperCase()} Enquiry Received: ${enquiry.name}`;
      const html = adminEnquiryTemplate(enquiry);

      // Dispatch email to each super admin recipient
      const emailPromises = Array.from(recipientEmails).map((recipient) =>
        this.sendEmail(recipient, subject, html)
      );

      await Promise.all(emailPromises);
    } catch (error: unknown) {
      logger.error(
        { err: error instanceof Error ? error.message : String(error) },
        "Error occurred while attempting to notify super admins of enquiry"
      );
    }
  }

}
