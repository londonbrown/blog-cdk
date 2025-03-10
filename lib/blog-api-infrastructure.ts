import * as cdk from "aws-cdk-lib"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as iam from "aws-cdk-lib/aws-iam"
import * as lambda from "aws-cdk-lib/aws-lambda"

import { Construct } from "constructs"

export enum BlogAPIStage {
  BETA = "Beta",
  PROD = "Prod"
}

export type BlogAPIInfrastructureProps = cdk.StackProps & {
  stage: BlogAPIStage
}

export class BlogAPIInfrastructure extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BlogAPIInfrastructureProps) {
    super(scope, id, props)
    const stage = props.stage

    // const blogPostsTable = new dynamodb.Table(this, `BlogPostsTable${stage}`, {
    //   tableName: `BlogPosts${stage}`,
    //   partitionKey: { name: "postId", type: dynamodb.AttributeType.STRING },
    //   sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
    //   billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    //   removalPolicy: cdk.RemovalPolicy.RETAIN
    // })
    //
    // blogPostsTable.addGlobalSecondaryIndex({
    //   indexName: "PublishedIndex",
    //   partitionKey: { name: "published", type: AttributeType.STRING },
    //   sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING }
    // })
    //
    // new cdk.CfnOutput(this, "BlogPostsTableName", {
    //   value: blogPostsTable.tableName
    // })

    const api = new apigateway.RestApi(this, `BlogAPIGateway${stage}`, {
      restApiName: `Blog API (${stage})`,
      description: "API Gateway for the blog service"
    })

    const postRoot = api.root.addResource("post")

    const getPostRole = new iam.Role(this, `GetPostLambdaRole${stage}`, {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
      ]
    })
    // getPostRole.addToPolicy(
    //   new iam.PolicyStatement({
    //     actions: ["dynamodb:GetItem"],
    //     resources: [blogPostsTable.tableArn]
    //   })
    // )

    const lambdaConfigs = [
      {
        name: "HelloWorld",
        root: api.root,
        path: "hello",
        method: "GET",
        zipFile: "lambdas/hello-world.zip"
      },
      {
        name: "GetPost",
        root: postRoot,
        path: "{id}",
        method: "GET",
        zipFile: "lambdas/get-post.zip",
        role: getPostRole
        // environment: {
        //   BLOG_POSTS_TABLE: blogPostsTable.tableName
        // }
      }
    ]

    lambdaConfigs.forEach((config) => {
      const lambdaFunction = new lambda.Function(this, `${config.name}Lambda${stage}`, {
        role: config.role,
        runtime: lambda.Runtime.PROVIDED_AL2023,
        handler: "bootstrap",
        code: lambda.Code.fromAsset(config.zipFile)
        // environment: config.environment
      })
      const apiResource = config.root.addResource(config.path)
      apiResource.addMethod(config.method, new apigateway.LambdaIntegration(lambdaFunction))
    })
  }
}
