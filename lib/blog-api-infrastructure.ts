import * as cdk from "aws-cdk-lib"
import * as cognito from "aws-cdk-lib/aws-cognito"
import { Construct } from "constructs"

import { setupApiGateway } from "./blog-api-infrastructure/api-gateway"
import { setupCertificates } from "./blog-api-infrastructure/certificates"
import { setupCognito } from "./blog-api-infrastructure/cognito"
import { setupDns } from "./blog-api-infrastructure/dns"
import { setupDynamoDb } from "./blog-api-infrastructure/dynamodb"
import { setupS3 } from "./blog-api-infrastructure/s3"

export enum BlogAPIStage {
  BETA = "Beta",
  PROD = "Prod"
}

export type BlogAPIInfrastructureProps = cdk.StackProps & {
  stage: BlogAPIStage
}

export class BlogAPIInfrastructure extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BlogAPIInfrastructureProps) {
    super(scope, id, props)
    const stage = props.stage

    if (!process.env.ROOT_DOMAIN_NAME) {
      throw Error("ROOT_DOMAIN_NAME must be set in the environment")
    }

    const { blogDomainName, apiBlogDomainName, hostedZone } = setupDns(
      this,
      stage,
      process.env.ROOT_DOMAIN_NAME
    )

    const { primaryCertificate } = setupCertificates(
      this,
      stage,
      blogDomainName,
      apiBlogDomainName,
      hostedZone
    )

    const { blogPostsTable } = setupDynamoDb(this, stage)

    if (!process.env.BLOG_CONTENT_BUCKET_NAME_PREFIX) {
      throw new Error("BLOG_CONTENT_BUCKET_NAME_PREFIX must be set in the environment")
    }

    const bucketNamePrefix = process.env.BLOG_CONTENT_BUCKET_NAME_PREFIX
    const { blogContentBucket } = setupS3(this, stage, bucketNamePrefix)

    const { userPool, userPoolClient } = setupCognito(this, stage)

    setupApiGateway(
      this,
      stage,
      hostedZone,
      apiBlogDomainName,
      primaryCertificate,
      userPool,
      userPoolClient,
      blogContentBucket,
      blogPostsTable
    )
  }
}
