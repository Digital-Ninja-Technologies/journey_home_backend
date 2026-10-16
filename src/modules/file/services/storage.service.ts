// Provides the next part of the surrounding operation.
import {
  // Provides the next part of the surrounding operation.
  S3Client,
  // Provides the next part of the surrounding operation.
  PutObjectCommand,
  // Provides the next part of the surrounding operation.
  GetObjectCommand,
  // Provides the next part of the surrounding operation.
  HeadObjectCommand,
  // Provides the next part of the surrounding operation.
  DeleteObjectCommand,
// Closes the current block.
} from "@aws-sdk/client-s3";
// Imports getSignedUrl from @aws-sdk/s3-request-presigner.
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
// Imports env from ../../../config/application.
import { env } from "../../../config/application";

// Declares the service class that groups related application operations.
export class StorageService {
  // Provides the next part of the surrounding operation.
  private s3Client: S3Client;
  // Provides the next part of the surrounding operation.
  private bucketName: string;

  // Initializes the service and its dependencies.
  // Calls constructor to perform the next step.
  constructor() {
    // Updates bucketName with the value on the right-hand side.
    this.bucketName = env.TIGRIS_BUCKET_NAME;
    // Updates s3Client with the value on the right-hand side.
    this.s3Client = new S3Client({
      // Declares the region property with type or value env.TIGRIS_REGION,.
      region: env.TIGRIS_REGION,
      // Declares the endpoint property with type or value env.TIGRIS_ENDPOINT,.
      endpoint: env.TIGRIS_ENDPOINT,
      // Declares the credentials property with type or value {.
      credentials: {
        // Declares the accessKeyId property with type or value env.TIGRIS_ACCESS_KEY_ID,.
        accessKeyId: env.TIGRIS_ACCESS_KEY_ID,
        // Declares the secretAccessKey property with type or value env.TIGRIS_SECRET_ACCESS_KEY,.
        secretAccessKey: env.TIGRIS_SECRET_ACCESS_KEY,
      // Closes the current block.
      },
    // Closes the current block.
    });
  // Closes the current block.
  }

  // Generates the requested value.
  // Declares a function or method used by this service.
  async generateUploadUrl(storageKey: string, contentType: string, expiresIn = 3600): Promise<string> {
    // Stores the result of PutObjectCommand in command.
    const command = new PutObjectCommand({
      // Declares the Bucket property with type or value this.bucketName,.
      Bucket: this.bucketName,
      // Declares the Key property with type or value storageKey,.
      Key: storageKey,
      // Declares the ContentType property with type or value contentType,.
      ContentType: contentType,
    // Closes the current block.
    });
    // Returns getSignedUrl(this.s3Client, command, { expiresIn }) to the caller.
    return getSignedUrl(this.s3Client, command, { expiresIn });
  // Closes the current block.
  }

  // Generates the requested value.
  // Declares a function or method used by this service.
  async generateDownloadUrl(storageKey: string, expiresIn = 900): Promise<string> {
    // Stores the result of GetObjectCommand in command.
    const command = new GetObjectCommand({
      // Declares the Bucket property with type or value this.bucketName,.
      Bucket: this.bucketName,
      // Declares the Key property with type or value storageKey,.
      Key: storageKey,
    // Closes the current block.
    });
    // Returns getSignedUrl(this.s3Client, command, { expiresIn }) to the caller.
    return getSignedUrl(this.s3Client, command, { expiresIn });
  // Closes the current block.
  }

  // Performs the requested service operation.
  // Declares a function or method used by this service.
  async headObject(storageKey: string): Promise<{ contentLength?: number; contentType?: string }> {
    // Stores the result of HeadObjectCommand in command.
    const command = new HeadObjectCommand({
      // Declares the Bucket property with type or value this.bucketName,.
      Bucket: this.bucketName,
      // Declares the Key property with type or value storageKey,.
      Key: storageKey,
    // Closes the current block.
    });
    // Stores the result of this.s3Client.send in response.
    const response = await this.s3Client.send(command);
    // Returns { to the caller.
    return {
      // Declares the contentLength property with type or value response.ContentLength,.
      contentLength: response.ContentLength,
      // Declares the contentType property with type or value response.ContentType,.
      contentType: response.ContentType,
    // Closes the current block.
    };
  // Closes the current block.
  }

  // Deletes the matching record.
  // Declares a function or method used by this service.
  async deleteObject(storageKey: string): Promise<void> {
    // Stores the result of DeleteObjectCommand in command.
    const command = new DeleteObjectCommand({
      // Declares the Bucket property with type or value this.bucketName,.
      Bucket: this.bucketName,
      // Declares the Key property with type or value storageKey,.
      Key: storageKey,
    // Closes the current block.
    });
    // Waits for s3Client.send to finish before continuing.
    await this.s3Client.send(command);
  // Closes the current block.
  }
// Closes the current block.
}
