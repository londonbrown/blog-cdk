import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import * as iam from "aws-cdk-lib/aws-iam"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as s3 from "aws-cdk-lib/aws-s3"
import { Construct } from "constructs"

import { createLambdaFunction } from "./lambda-config"

export function createCreateContentLambda(
  scope: Construct,
  stage: string,
  table: dynamodb.Table,
  bucket: s3.Bucket
): lambda.Function {
  return createLambdaFunction(scope, `CreateContentLambda${stage}`, {
    lambdaPath: "lambdas/create-content.zip",
    rolePermissions: {
      policyStatements: [
        new iam.PolicyStatement({
          actions: ["dynamodb:GetItem", "dynamodb:PutItem"],
          resources: [table.tableArn]
        }),
        new iam.PolicyStatement({
          actions: ["s3:PutObject", "s3:PutObjectAcl"],
          resources: [`${bucket.bucketArn}/*`]
        })
      ]
    },
    environment: {
      BLOG_CONTENT_TABLE: table.tableName,
      BLOG_CONTENT_BUCKET: bucket.bucketName
    }
  })
}
