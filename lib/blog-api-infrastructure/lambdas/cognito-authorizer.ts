import { Stack } from "aws-cdk-lib"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import { UserPool } from "aws-cdk-lib/aws-cognito"
import * as cognito from "aws-cdk-lib/aws-cognito"
import * as lambda from "aws-cdk-lib/aws-lambda"
import { Construct } from "constructs"

import { createLambdaFunction } from "./lambda-config"

export function createCognitoAuthorizerLambda(
  scope: Construct,
  stage: string,
  userPool: UserPool,
  apiGateway: apigateway.RestApi,
  adminClient: cognito.UserPoolClient,
  authorClient: cognito.UserPoolClient,
  commenterClient: cognito.UserPoolClient,
  guestClient: cognito.UserPoolClient
): lambda.Function {
  return createLambdaFunction(scope, `CognitoAuthorizerLambda${stage}`, {
    lambdaPath: "lambdas/cognito-authorizer.zip",
    environment: {
      USER_POOL_ID: userPool.userPoolId,
      AWS_ACCOUNT_ID: Stack.of(scope).account,
      API_GATEWAY_ID: apiGateway.restApiId,
      ADMIN_CLIENT_ID: adminClient.userPoolClientId,
      AUTHOR_CLIENT_ID: authorClient.userPoolClientId,
      COMMENTER_CLIENT_ID: commenterClient.userPoolClientId,
      GUEST_CLIENT_ID: guestClient.userPoolClientId
    }
  })
}
