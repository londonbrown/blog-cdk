import * as lambda from "aws-cdk-lib/aws-lambda"
import { Construct } from "constructs"

import { createLambdaFunction } from "./lambda-config"

export function createGuestJwtGeneratorLambda(scope: Construct, stage: string): lambda.Function {
  return createLambdaFunction(scope, `GuestJwtGeneratorLambda${stage}`, {
    lambdaPath: "lambdas/guest-jwt-generator.zip",
    rolePermissions: {
      policyStatements: []
    }
  })
}
