import { Stack } from "aws-cdk-lib"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import { UserPool } from "aws-cdk-lib/aws-cognito"
import * as cognito from "aws-cdk-lib/aws-cognito"
import * as iam from "aws-cdk-lib/aws-iam"
import * as lambda from "aws-cdk-lib/aws-lambda"
import { Construct } from "constructs"

import { createLambdaFunction } from "./lambda-config"

export function createCognitoAuthorizerLambda(
  scope: Construct,
  stage: string,
  userPool: UserPool,
  apiGateway: apigateway.RestApi,
  userPoolClient: cognito.UserPoolClient,
  adminPolicy: iam.ManagedPolicy,
  authenticatedPolicy: iam.ManagedPolicy,
  authorPolicy: iam.ManagedPolicy,
  guestPolicy: iam.ManagedPolicy
): lambda.Function {
  return createLambdaFunction(scope, `CognitoAuthorizerLambda${stage}`, {
    lambdaPath: "lambdas/cognito-authorizer.zip",
    environment: {
      USER_POOL_ID: userPool.userPoolId,
      AWS_ACCOUNT_ID: Stack.of(scope).account,
      API_GATEWAY_ID: apiGateway.restApiId,
      COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
      ADMIN_POLICY_ARN: adminPolicy.managedPolicyArn,
      AUTHENTICATED_POLICY_ARN: authenticatedPolicy.managedPolicyArn,
      AUTHOR_POLICY_ARN: authorPolicy.managedPolicyArn,
      GUEST_POLICY_ARN: guestPolicy.managedPolicyArn
    }
  })
}
