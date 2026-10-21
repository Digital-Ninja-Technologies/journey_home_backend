// Imports axios from axios.
import axios from "axios";
// Imports env from ../../config/application.
import { env } from "../../config/application";
// Imports User, UserRole from ../../modules/auth/models/auth.model.
import { User, UserRole } from "../../modules/auth/models/auth.model";
// Imports logger from ../logger/logger.
import { logger } from "../logger/logger";

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

// Provides the next part of the surrounding operation.
interface BasicEnquiry {
  // Declares the type property with type or value string.
  type?: string;
  // Declares the source property with type or value string.
  source?: string;
  // Declares the name property with type or value string.
  name: string;
  // Declares the email property with type or value string.
  email?: string;
  // Declares the phone property with type or value string.
  phone?: string;
  details?: unknown;
  // Declares the createdAt property with type or value Date.
  createdAt?: Date;
// Closes the current block.
}

// Declares the service class that groups related application operations.
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
      // Stores the result of this.generateEnquiryEmailTemplate in html.
      const html = this.generateEnquiryEmailTemplate(enquiry);

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

  // Generates the requested value.
  // Provides the next part of the surrounding operation.
  public generateEnquiryEmailTemplate(enquiry: BasicEnquiry): string {
    // Defines formattedType using the value on the right-hand side.
    const formattedType = enquiry.type
      // Provides the next part of the surrounding operation.
      ? enquiry.type.toUpperCase()
      // Provides the next part of the surrounding operation.
      : "GENERAL";
    // Defines formattedSource using the value on the right-hand side.
    const formattedSource = enquiry.source
      // Provides the next part of the surrounding operation.
      ? enquiry.source.replace(/_/g, " ").toUpperCase()
      // Provides the next part of the surrounding operation.
      : "DIRECT";
    // Defines createdAtStr using the value on the right-hand side.
    const createdAtStr = enquiry.createdAt
      // Provides the next part of the surrounding operation.
      ? new Date(enquiry.createdAt).toLocaleString("en-US", {
          // Declares the dateStyle property with type or value "full",.
          dateStyle: "full",
          // Declares the timeStyle property with type or value "short",.
          timeStyle: "short",
        // Closes the current block.
        })
      // Provides the next part of the surrounding operation.
      : new Date().toLocaleString("en-US", {
          // Declares the dateStyle property with type or value "full",.
          dateStyle: "full",
          // Declares the timeStyle property with type or value "short",.
          timeStyle: "short",
        // Closes the current block.
        });

    // Defines detailsHtml using the value on the right-hand side.
    let detailsHtml = "";

    // Runs the following branch when enquiry.details is true.
    if (enquiry.details) {
      // Defines details using the value on the right-hand side.
      const details = toRecord(enquiry.details);
      const priceRange = toRecord(details.priceRange);

        // Runs the following branch when enquiry.type === "customer" is true.
        if (enquiry.type === "customer") {
        // Stores the result of Array.isArray in appliancesList.
        const appliancesList = Array.isArray(details.appliances)
          // Provides the next part of the surrounding operation.
          ? details.appliances
              // Calls .map to perform the next step.
              .map(
                // Provides the next part of the surrounding operation.
                (app: unknown) => {
                  const appliance = toRecord(app);
                  return `<li style="margin-bottom: 4px;"><strong>${appliance.name || "Appliance"}</strong> (${appliance.wattage || 0}W x ${appliance.quantity || 0})</li>`;
                }
              // Provides the next part of the surrounding operation.
              )
              // Calls .join to perform the next step.
              .join("")
          // Provides the next part of the surrounding operation.
          : "None specified";

        // Updates detailsHtml with the value on the right-hand side.
        detailsHtml = `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Property Type:</strong> ${details.propertyType || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Recommended Tier:</strong> <span style="color: #10B981; font-weight: bold;">${details.preferredTier || details.calculatedSize || "N/A"}</span></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Price Range:</strong> ${priceRange.formatted || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Total Load:</strong> ${details.totalLoad || 0} W (${details.totalLoadKVA || 0} kVA)</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Backup Hours Needed:</strong> ${details.backupHours || "N/A"} hrs</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Site Inspection Requested:</strong> ${details.requestSiteInspection ? "Yes" : "No"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Payment Preference:</strong> ${details.paymentPreference || "Not specified"}</td>
          </tr>
        // Provides the next part of the surrounding operation.
        `;
      // Closes the current block.
      } else if (enquiry.type === "agent") {
        // Updates detailsHtml with the value on the right-hand side.
        detailsHtml = `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Territory:</strong> ${details.territory || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Current Occupation:</strong> ${details.currentOccupation || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Why Join:</strong> ${details.whyJoin || "N/A"}</td>
          </tr>
        // Provides the next part of the surrounding operation.
        `;
      // Closes the current block.
      } else if (enquiry.type === "investor") {
        // Updates detailsHtml with the value on the right-hand side.
        detailsHtml = `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Looking For:</strong> ${details.whatAreYouLookingFor || "N/A"}</td>
          </tr>
        // Provides the next part of the surrounding operation.
        `;
      // Closes the current block.
      } else if (enquiry.type === "careers") {
        // Updates detailsHtml with the value on the right-hand side.
        detailsHtml = `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Role Applied For:</strong> ${details.roleAppliedFor || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Experience:</strong> ${details.experience || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Location:</strong> ${details.location || "N/A"}</td>
        // Provides the next part of the surrounding operation.
        `;
      // Closes the current block.
      } else if (enquiry.type === "contact") {
        // Updates detailsHtml with the value on the right-hand side.
        detailsHtml = `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Message:</strong> ${details.message || "N/A"}</td>
          </tr>
        // Provides the next part of the surrounding operation.
        `;
      // Closes the current block.
      }
    // Closes the current block.
    }

    // Returns ` to the caller.
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Enquiry Notification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0F172A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card Wrapper -->
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
          
          <!-- Top Yellow Accent Line (Tiny touch of yellow) -->
          <tr>
            <td style="background-color: #F59E0B; height: 6px; width: 100%;"></td>
          </tr>

          <!-- Header (Navy Blue) -->
          <tr>
            <td style="background-color: #0F172A; padding: 28px 30px; text-align: left;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="color: #FFFFFF; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">GAVIKINA ENERGY</h1>
                    <p style="color: #10B981; margin: 4px 0 0 0; font-size: 13px; font-weight: 600; text-transform: uppercase;">New Enquiry Alert</p>
                  </td>
                  <td align="right" valign="middle">
                    <span style="background-color: #10B981; color: #FFFFFF; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 20px; text-transform: uppercase; display: inline-block;">
                      ${formattedType}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Sub-header Alert Banner -->
          <tr>
            <td style="background-color: #ECFDF5; border-bottom: 1px solid #A7F3D0; padding: 14px 30px;">
              <p style="margin: 0; color: #047857; font-size: 14px; font-weight: 600;">
                🔔 A new <strong>${formattedType}</strong> enquiry has been submitted via <strong>${formattedSource}</strong>.
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 30px;">
              
              <!-- Contact Information Section -->
              <h2 style="color: #0F172A; font-size: 16px; margin: 0 0 16px 0; border-left: 4px solid #10B981; padding-left: 10px;">
                Contact Details
              </h2>
              <table width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px; color: #334155; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; width: 35%;"><strong>Name:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #0F172A; font-weight: 600;">${enquiry.name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Email:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><a href="mailto:${enquiry.email || ""}" style="color: #10B981; text-decoration: none;">${enquiry.email || "N/A"}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Phone:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${enquiry.phone || "N/A"}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Received At:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${createdAtStr}</td>
                </tr>
              </table>

              ${
                detailsHtml
                  ? `
              // Provides the next part of the surrounding operation.
              <!-- Enquiry Specific Details -->
              // Provides the next part of the surrounding operation.
              <h2 style="color: #0F172A; font-size: 16px; margin: 24px 0 16px 0; border-left: 4px solid #10B981; padding-left: 10px;">
                // Provides the next part of the surrounding operation.
                Enquiry Details
              // Provides the next part of the surrounding operation.
              </h2>
              // Provides the next part of the surrounding operation.
              <table width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px; color: #334155;">
                // Provides the next part of the surrounding operation.
                ${detailsHtml}
              // Provides the next part of the surrounding operation.
              </table>
              `
                  : ""
              }

              <!-- Action Button / Link -->
              <table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30px;">
                <tr>
                  <td align="center">
                    <div style="background-color: #0F172A; color: #FFFFFF; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; text-decoration: none; display: inline-block;">
                      Log into Admin Dashboard to View Details
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer (Navy Blue & White) -->
          <tr>
            <td style="background-color: #0F172A; padding: 20px 30px; text-align: center; color: #94A3B8; font-size: 12px; border-top: 2px solid #F59E0B;">
              <p style="margin: 0 0 6px 0; color: #FFFFFF; font-weight: 600;">Gavikina Energy Admin Notification</p>
              <p style="margin: 0;">This is an automated notification sent to Super Admin accounts. Do not reply to this email.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    // Provides the next part of the surrounding operation.
    `;
  // Closes the current block.
  }
// Closes the current block.
}
