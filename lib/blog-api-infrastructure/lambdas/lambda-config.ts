import * as cdk from "aws-cdk-lib"
import * as iam from "aws-cdk-lib/aws-iam"
import * as lambda from "aws-cdk-lib/aws-lambda"
import { Construct } from "constructs"

const DEFAULT_MEMORY_SIZE = 256 // MB
const DEFAULT_TIMEOUT = cdk.Duration.seconds(10)
const DEFAULT_RUNTIME = lambda.Runtime.PROVIDED_AL2023 // Using Rust

export type LambdaConfig = {
  lambdaPath: string
  environment?: { [key: string]: string } | undefined
  rolePermissions?: {
    policyStatements: iam.PolicyStatement[]
  }
}

export function createLambdaFunction(
  scope: Construct,
  name: string,
  config: LambdaConfig
): lambda.Function {
  return new lambda.Function(scope, name, {
    role: createLambdaRole(scope, name, config.rolePermissions),
    runtime: DEFAULT_RUNTIME,
    handler: "bootstrap",
    code: lambda.Code.fromAsset(config.lambdaPath),
    memorySize: DEFAULT_MEMORY_SIZE,
    timeout: DEFAULT_TIMEOUT,
    environment: config.environment
  })
}

function createLambdaRole(
  scope: Construct,
  name: string,
  config: LambdaConfig["rolePermissions"]
): iam.Role {
  const role = new iam.Role(scope, `${name}Role`, {
    assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
    ]
  })

  config?.policyStatements.forEach((policyStatement) => {
    role.addToPolicy(policyStatement)
  })

  return role
}
