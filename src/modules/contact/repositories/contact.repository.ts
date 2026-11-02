import { PageOptions, escapeRegex } from "../../../common/utils/pagination";
import { ContactSubmission, IContactSubmission } from "../models/contact.model";

export class ContactRepository {
  create(data: Pick<IContactSubmission, "name" | "phone" | "email" | "topic" | "message">) {
    return ContactSubmission.create(data);
  }

  listAll(options: PageOptions, search?: string) {
    const query: Record<string, unknown> = {};
    if (search) {
      const pattern = escapeRegex(search);
      query.$or = [
        { name: { $regex: pattern, $options: "i" } },
        { email: { $regex: pattern, $options: "i" } },
      ];
    }

    return Promise.all([
      ContactSubmission.find(query)
        .sort({ createdAt: -1 })
        .skip(options.skip)
        .limit(options.limit)
        .exec(),
      ContactSubmission.countDocuments(query).exec(),
    ]);
  }

  findById(id: string) {
    return ContactSubmission.findById(id).exec();
  }
}
