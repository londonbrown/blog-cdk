import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager"
import { Construct } from "constructs"

export function setupSecrets(scope: Construct, stage: string) {
  const guestUserPasswordSecret = new secretsmanager.Secret(
    scope,
    `BlogGuestUserPassword${stage}`,
    {
      secretName: `BlogGuestUserPassword${stage}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "guest-user" }),
        generateStringKey: "password",
        passwordLength: 32
      }
    }
  )

  return { guestUserPasswordSecret }
}
