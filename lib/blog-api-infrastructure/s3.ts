import { RemovalPolicy } from "aws-cdk-lib"
import * as s3 from "aws-cdk-lib/aws-s3"
import { Construct } from "constructs"

export function setupS3(scope: Construct, stage: string, contentBucketNamePrefix: string) {
  const blogContentBucket = new s3.Bucket(scope, `BlogContentBucket${stage}`, {
    bucketName: contentBucketNamePrefix + stage.toLocaleLowerCase(),
    removalPolicy: RemovalPolicy.RETAIN
  })

  return { blogContentBucket }
}
