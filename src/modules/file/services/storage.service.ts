import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../../config/application";

export class StorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.bucketName = env.TIGRIS_BUCKET_NAME;
    this.s3Client = new S3Client({
      region: env.TIGRIS_REGION,
      endpoint: env.TIGRIS_ENDPOINT,
      credentials: {
        accessKeyId: env.TIGRIS_ACCESS_KEY_ID,
        secretAccessKey: env.TIGRIS_SECRET_ACCESS_KEY,
      },
    });
  }

  async generateUploadUrl(storageKey: string, contentType: string, expiresIn = 3600): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
      ContentType: contentType,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async generateDownloadUrl(storageKey: string, expiresIn = 900): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async headObject(storageKey: string): Promise<{ contentLength?: number; contentType?: string }> {
    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
    });
    const response = await this.s3Client.send(command);
    return {
      contentLength: response.ContentLength,
      contentType: response.ContentType,
    };
  }

  async deleteObject(storageKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
    });
    await this.s3Client.send(command);
  }
}
