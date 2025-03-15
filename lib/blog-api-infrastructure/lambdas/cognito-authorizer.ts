import { UserPool } from "aws-cdk-lib/aws-cognito"
import * as lambda from "aws-cdk-lib/aws-lambda"
import { Construct } from "constructs"

import { createLambdaFunction } from "./lambda-config"

export function createCognitoAuthorizerLambda(
  scope: Construct,
  stage: string,
  userPool: UserPool
): lambda.Function {
  return createLambdaFunction(scope, `CognitoAuthorizerLambda${stage}`, {
    lambdaPath: "lambdas/cognito-authorizer.zip",
    environment: {
      USER_POOL_ID: userPool.userPoolId
    }
  })
}
