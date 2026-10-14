import axios from "axios";
import { env } from "../../config/application";
import { User, UserRole } from "../../modules/auth/models/auth.model";
import { logger } from "../logger/logger";

interface BasicEnquiry {
  type?: string;
  source?: string;
  name: string;
  email?: string;
  phone?: string;
  details?: any;
  createdAt?: Date;
}

export class EmailService {
 
  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      const payload: { to: string; subject: string; html: string } = {
        to,
        subject,
        html,
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      await axios.post(env.EMAIL_SERVICE_URL, payload, { headers });
      logger.info({ to, subject }, "Email sent successfully via Email Service");
      return true;
    } catch (error: any) {
      logger.error(
        { err: error?.response?.data || error.message, to, subject },
        "Failed to send email via Email Service"
      );
      return false;
    }
  }

  async notifySuperAdminsOfEnquiry(enquiry: BasicEnquiry): Promise<void> {
    try {
      //Get Super Admin emails from Database
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

      //Add .env fallback email if provided
      if (env.SUPER_ADMIN_EMAIL && env.SUPER_ADMIN_EMAIL.trim()) {
        recipientEmails.add(env.SUPER_ADMIN_EMAIL.trim().toLowerCase());
      }

      if (recipientEmails.size === 0) {
        logger.warn(
          "No Super Admin email recipients found"
        );
        return;
      }

      //Compile HTML template
      const subject = `[Gavikina Energy] New ${(enquiry.type || "general").toUpperCase()} Enquiry Received: ${enquiry.name}`;
      const html = this.generateEnquiryEmailTemplate(enquiry);

      //Dispatch email to each super admin recipient
      const emailPromises = Array.from(recipientEmails).map((recipient) =>
        this.sendEmail(recipient, subject, html)
      );

      await Promise.all(emailPromises);
    } catch (error: any) {
      logger.error(
        { err: error.message },
        "Error occurred while attempting to notify super admins of enquiry"
      );
    }
  }

  public generateEnquiryEmailTemplate(enquiry: BasicEnquiry): string {
    const formattedType = enquiry.type
      ? enquiry.type.toUpperCase()
      : "GENERAL";
    const formattedSource = enquiry.source
      ? enquiry.source.replace(/_/g, " ").toUpperCase()
      : "DIRECT";
    const createdAtStr = enquiry.createdAt
      ? new Date(enquiry.createdAt).toLocaleString("en-US", {
          dateStyle: "full",
          timeStyle: "short",
        })
      : new Date().toLocaleString("en-US", {
          dateStyle: "full",
          timeStyle: "short",
        });

    let detailsHtml = "";

    if (enquiry.details) {
      const details = enquiry.details as any;

        if (enquiry.type === "customer") {
        const appliancesList = Array.isArray(details.appliances)
          ? details.appliances
              .map(
                (app: any) =>
                  `<li style="margin-bottom: 4px;"><strong>${app.name}</strong> (${app.wattage}W x ${app.quantity})</li>`
              )
              .join("")
          : "None specified";

        detailsHtml = `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Property Type:</strong> ${details.propertyType || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Recommended Tier:</strong> <span style="color: #10B981; font-weight: bold;">${details.preferredTier || details.calculatedSize || "N/A"}</span></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Price Range:</strong> ${details.priceRange?.formatted || "N/A"}</td>
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
        `;
      } else if (enquiry.type === "agent") {
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
        `;
      } else if (enquiry.type === "investor") {
        detailsHtml = `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Looking For:</strong> ${details.whatAreYouLookingFor || "N/A"}</td>
          </tr>
        `;
      } else if (enquiry.type === "careers") {
        detailsHtml = `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Role Applied For:</strong> ${details.roleAppliedFor || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Experience:</strong> ${details.experience || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Location:</strong> ${details.location || "N/A"}</td>
        `;
      } else if (enquiry.type === "contact") {
        detailsHtml = `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Message:</strong> ${details.message || "N/A"}</td>
          </tr>
        `;
      }
    }

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
              <!-- Enquiry Specific Details -->
              <h2 style="color: #0F172A; font-size: 16px; margin: 24px 0 16px 0; border-left: 4px solid #10B981; padding-left: 10px;">
                Enquiry Details
              </h2>
              <table width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px; color: #334155;">
                ${detailsHtml}
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
    `;
  }
}
