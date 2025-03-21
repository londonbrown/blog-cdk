import * as cognito from "aws-cdk-lib/aws-cognito"
import * as iam from "aws-cdk-lib/aws-iam"
import { Effect } from "aws-cdk-lib/aws-iam"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager"
import { Construct } from "constructs"

import { createLambdaFunction } from "./lambda-config"

export function createGuestJwtGeneratorLambda(
  scope: Construct,
  stage: string,
  guestClient: cognito.UserPoolClient,
  guestUserPasswordSecret: secretsmanager.Secret
): lambda.Function {
  return createLambdaFunction(scope, `GuestJwtGeneratorLambda${stage}`, {
    lambdaPath: "lambdas/guest-jwt-generator.zip",
    rolePermissions: {
      policyStatements: [
        new iam.PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["secretsmanager:GetSecretValue"],
          resources: [guestUserPasswordSecret.secretArn]
        })
      ]
    },
    environment: {
      COGNITO_USER_PASSWORD_SECRET_NAME: guestUserPasswordSecret.secretName,
      COGNITO_CLIENT_ID: guestClient.userPoolClientId
    }
  })
}
