import * as cdk from "aws-cdk-lib"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as path from "node:path"
import { Construct } from "constructs"

export enum BlogAPIStage {
  Beta,
  Prod
}

export type BlogAPIInfrastructureProps = cdk.StackProps & {
  stage: BlogAPIStage
}

export class BlogAPIInfrastructure extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BlogAPIInfrastructureProps) {
    super(scope, id, props)
    const stage = props.stage

    const lambdaConfigs = [{ name: "HelloWorld", zipFile: "lambdas/hello-world.zip" }]

    lambdaConfigs.forEach((config) => {
      new lambda.Function(this, `${config.name}Lambda${stage}`, {
        runtime: lambda.Runtime.PROVIDED_AL2,
        handler: "bootstrap",
        code: lambda.Code.fromAsset(path.join("..", config.zipFile))
      })
    })
  }
}
