
import dotenv from "dotenv";

dotenv.config();
console.log(process.env.JWT_SECRET);
export const env = {
    NODE_ENV: process.env.NODE_ENV || "development",

    PORT: Number(process.env.APP_PORT) || 2041,

    JWT_SECRET: process.env.JWT_SECRET!,

    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,

   MONGODB_URI: process.env.MONGODB_URI!,

   TIGRIS_ENDPOINT: process.env.TIGRIS_ENDPOINT || "https://t3.storage.dev",
   TIGRIS_REGION: process.env.TIGRIS_REGION || "auto",
   TIGRIS_ACCESS_KEY_ID: process.env.TIGRIS_ACCESS_KEY_ID || "",
   TIGRIS_SECRET_ACCESS_KEY: process.env.TIGRIS_SECRET_ACCESS_KEY || "",
   TIGRIS_BUCKET_NAME: process.env.TIGRIS_BUCKET_NAME || "nasas-empire-bucket",

   EMAIL_SERVICE_URL:
     process.env.EMAIL_SERVICE_URL ||
     "https://email-service-one-alpha.vercel.app/api/mail/send",
   SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL || "",
};