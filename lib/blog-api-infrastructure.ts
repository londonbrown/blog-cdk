import * as cdk from "aws-cdk-lib"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as apigateway from "aws-cdk-lib/aws-apigateway"

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

    const api = new apigateway.RestApi(this, `BlogAPIGateway${stage}`, {
      restApiName: `Blog API (${stage})`,
      description: "API Gateway for the blog service"
    })

    const lambdaConfigs = [
      {
        name: "HelloWorld",
        root: api.root,
        path: "hello",
        method: "GET",
        zipFile: "lambdas/hello-world.zip"
      }
    ]

    lambdaConfigs.forEach((config) => {
      const lambdaFunction = new lambda.Function(this, `${config.name}Lambda${stage}`, {
        runtime: lambda.Runtime.PROVIDED_AL2023,
        handler: "bootstrap",
        code: lambda.Code.fromAsset(config.zipFile)
      })
      const apiResource = config.root.addResource(config.path)
      apiResource.addMethod(config.method, new apigateway.LambdaIntegration(lambdaFunction))
    })
  }
}
