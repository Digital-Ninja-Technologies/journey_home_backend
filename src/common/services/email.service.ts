// Imports axios from axios.
import axios from "axios";
// Imports env from ../../config/application.
import { env } from "../../config/application";
// Imports User, UserRole from ../../modules/auth/models/auth.model.
import { User, UserRole } from "../../modules/auth/models/auth.model";
// Imports logger from ../logger/logger.
import { logger } from "../logger/logger";
import { adminEnquiryTemplate, BasicEnquiry } from "../../modules/auth/templates/admin-enquiry.template";

export class EmailService {
 
  // Sends an email using the configured delivery provider.
  // Declares a function or method used by this service.
  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    // Starts an operation whose errors are handled below.
    try {
      // Provides the next part of the surrounding operation.
      const payload: { to: string; subject: string; html: string } = {
        // Provides the next part of the surrounding operation.
        to,
        // Provides the next part of the surrounding operation.
        subject,
        // Provides the next part of the surrounding operation.
        html,
      // Closes the current block.
      };

      // Provides the next part of the surrounding operation.
      const headers: Record<string, string> = {
        // Provides the next part of the surrounding operation.
        "Content-Type": "application/json",
      // Closes the current block.
      };

      // Waits for axios.post to finish before continuing.
      await axios.post(env.EMAIL_SERVICE_URL, payload, { headers });
      // Calls logger.info to perform the next step.
      logger.info({ to, subject }, "Email sent successfully via Email Service");
      // Returns true to the caller.
      return true;
    // Closes the current block.
    } catch (error: unknown) {
      // Calls logger.error to perform the next step.
      logger.error(
        // Opens the block for the declaration or control flow above.
        { err: error instanceof Error ? error.message : String(error), to, subject },
        "Failed to send email via Email Service"
      // Provides the next part of the surrounding operation.
      );
      // Returns false to the caller.
      return false;
    // Closes the current block.
    }
  // Closes the current block.
  }

  // Sends an enquiry notification to the super administrators.
  // Declares a function or method used by this service.
  async notifySuperAdminsOfEnquiry(enquiry: BasicEnquiry): Promise<void> {
    // Starts an operation whose errors are handled below.
    try {
      //Get Super Admin emails from Database
      // Stores the result of User.find in superAdmins.
      const superAdmins = await User.find({
        // Declares the $or property with type or value [{ role: UserRole.SUPER_ADMIN }, { isSuperAdmin: true }],.
        $or: [{ role: UserRole.SUPER_ADMIN }, { isSuperAdmin: true }],
      // Closes the current block.
      })
        // Calls .select to perform the next step.
        .select("email")
        // Calls .lean to perform the next step.
        .lean();

      // Defines recipientEmails using the value on the right-hand side.
      const recipientEmails = new Set<string>();

      // Calls superAdmins.forEach to perform the next step.
      superAdmins.forEach((user) => {
        // Runs the following branch when user.email && user.email.trim() is true.
        if (user.email && user.email.trim()) {
          // Calls recipientEmails.add to perform the next step.
          recipientEmails.add(user.email.trim().toLowerCase());
        // Closes the current block.
        }
      // Closes the current block.
      });

      //Add .env fallback email if provided
      // Runs the following branch when env.SUPER_ADMIN_EMAIL && env.SUPER_ADMIN_EMAIL.trim() is true.
      if (env.SUPER_ADMIN_EMAIL && env.SUPER_ADMIN_EMAIL.trim()) {
        // Calls recipientEmails.add to perform the next step.
        recipientEmails.add(env.SUPER_ADMIN_EMAIL.trim().toLowerCase());
      // Closes the current block.
      }

      // Runs the following branch when recipientEmails.size === 0 is true.
      if (recipientEmails.size === 0) {
        // Calls logger.warn to perform the next step.
        logger.warn(
          "No Super Admin email recipients found"
        // Provides the next part of the surrounding operation.
        );
        // Provides the next part of the surrounding operation.
        return;
      // Closes the current block.
      }

      //Compile HTML template
      // Stores the result of toUpperCase in subject.
      const subject = `[Gavikina Energy] New ${(enquiry.type || "general").toUpperCase()} Enquiry Received: ${enquiry.name}`;
      // Renders the admin enquiry email from its reusable template.
      const html = adminEnquiryTemplate(enquiry);

      //Dispatch email to each super admin recipient
      // Stores the result of Array.from in emailPromises.
      const emailPromises = Array.from(recipientEmails).map((recipient) =>
        // Calls sendEmail to perform the next step.
        this.sendEmail(recipient, subject, html)
      // Provides the next part of the surrounding operation.
      );

      // Waits for Promise.all to finish before continuing.
      await Promise.all(emailPromises);
    // Closes the current block.
    } catch (error: unknown) {
      // Calls logger.error to perform the next step.
      logger.error(
        // Opens the block for the declaration or control flow above.
        { err: error instanceof Error ? error.message : String(error) },
        "Error occurred while attempting to notify super admins of enquiry"
      // Provides the next part of the surrounding operation.
      );
    // Closes the current block.
    }
  // Closes the current block.
  }

}
