import * as cdk from "aws-cdk-lib"
import * as lambda from "aws-cdk-lib/aws-lambda"
import { Construct } from "constructs"
import * as fs from "node:fs"

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
        runtime: lambda.Runtime.PROVIDED_AL2023,
        handler: "bootstrap",
        code: lambda.Code.fromAsset(config.zipFile)
      })
    })
  }
}
