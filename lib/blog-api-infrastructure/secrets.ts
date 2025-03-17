import * as cognito from "aws-cdk-lib/aws-cognito"
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager"
import { Construct } from "constructs"

export function setupSecrets(
  scope: Construct,
  stage: string,
  cognitoUser: cognito.CfnUserPoolUser
) {
  const guestUserPasswordSecret = new secretsmanager.Secret(
    scope,
    `BlogGuestUserPassword${stage}`,
    {
      secretName: `BlogGuestUserPassword${stage}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: cognitoUser.username }),
        excludePunctuation: true,
        generateStringKey: "password",
        passwordLength: 32
      }
    }
  )

  return { guestUserPasswordSecret }
}
