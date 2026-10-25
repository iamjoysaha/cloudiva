import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3, S3_BUCKET } from "../services/s3_client.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PRESIGNED_URL_EXPIRY } from "./constants.js";

const getPresignedUrl = async (
  s3Key: string,
  mimeType: string,
  expiresIn = PRESIGNED_URL_EXPIRY,
): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    ResponseContentType: mimeType,
    ResponseContentDisposition: "inline",
  });

  return getSignedUrl(s3, command, { expiresIn });
};

export {
    getPresignedUrl,
}