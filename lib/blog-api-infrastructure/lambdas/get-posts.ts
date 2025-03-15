import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import * as iam from "aws-cdk-lib/aws-iam"
import * as lambda from "aws-cdk-lib/aws-lambda"
import { Construct } from "constructs"

import { createLambdaFunction } from "./lambda-config"

export function createGetPostsLambda(
  scope: Construct,
  stage: string,
  table: dynamodb.Table
): lambda.Function {
  return createLambdaFunction(scope, `GetPostsLambda${stage}`, {
    lambdaPath: "lambdas/get-posts.zip",
    rolePermissions: {
      policyStatements: [
        new iam.PolicyStatement({
          actions: ["dynamodb:GetItem"],
          resources: [table.tableArn]
        })
      ]
    },
    environment: {
      BLOG_POSTS_TABLE: table.tableName
    }
  })
}
