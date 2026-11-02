import mongoose, { Document, Schema } from "mongoose";

export enum ContactTopic {
  STARTING_A_PLAN = "Starting a plan",
  EXISTING_PLAN = "An existing plan",
  PHOTOGRAPHER_NETWORK = "Photographer network",
  SOMETHING_ELSE = "Something else",
}

export interface IContactSubmission extends Document {
  name: string;
  phone: string;
  email: string;
  topic: ContactTopic;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContactSubmissionSchema = new Schema<IContactSubmission>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    topic: { type: String, required: true, enum: Object.values(ContactTopic) },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
  },
  { timestamps: true },
);

ContactSubmissionSchema.index({ createdAt: -1 });
ContactSubmissionSchema.index({ name: 1 });
ContactSubmissionSchema.index({ email: 1 });

export const ContactSubmission = mongoose.model<IContactSubmission>(
  "ContactSubmission",
  ContactSubmissionSchema,
);
