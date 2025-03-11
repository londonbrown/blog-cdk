import * as cdk from "aws-cdk-lib"
import { RemovalPolicy } from "aws-cdk-lib"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as acm from "aws-cdk-lib/aws-certificatemanager"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import * as iam from "aws-cdk-lib/aws-iam"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as route53 from "aws-cdk-lib/aws-route53"
import * as route53Targets from "aws-cdk-lib/aws-route53-targets"
import * as s3 from "aws-cdk-lib/aws-s3"
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

    if (!process.env.ROOT_DOMAIN_NAME) {
      throw Error("ROOT_DOMAIN_NAME not set")
    }

    const hostedZoneDomainName = process.env.ROOT_DOMAIN_NAME
    const blogDomainName =
      stage != BlogAPIStage.PROD
        ? `${stage}.blog.${hostedZoneDomainName}`
        : `blog.${hostedZoneDomainName}`
    const apiBlogDomainName = `api.${blogDomainName}`

    const hostedZone = route53.HostedZone.fromLookup(this, "ChaimCodesHostedZone", {
      domainName: hostedZoneDomainName
    })

    const certificate = new acm.Certificate(this, `BlogCertificate${stage}`, {
      domainName: blogDomainName,
      subjectAlternativeNames: [apiBlogDomainName],
      validation: acm.CertificateValidation.fromDns(hostedZone)
    })

    const blogPostsTable = new dynamodb.Table(this, `BlogPostsTable${stage}`, {
      tableName: `BlogPosts${stage}`,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    })

    blogPostsTable.addGlobalSecondaryIndex({
      indexName: "CreatedAtIndex",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING }
    })

    blogPostsTable.addGlobalSecondaryIndex({
      indexName: "PublishedIndex",
      partitionKey: { name: "published", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING }
    })

    new cdk.CfnOutput(this, "BlogPostsTableName", {
      value: blogPostsTable.tableName
    })

    const bucketNamePrefix = process.env.BLOG_CONTENT_BUCKET_NAME_PREFIX
    const blogContentBucket = new s3.Bucket(this, `BlogContentBucket${stage}`, {
      bucketName: bucketNamePrefix + stage.toLocaleLowerCase(),
      removalPolicy: RemovalPolicy.RETAIN
    })

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

    getPostRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:BatchGetItem", "dynamodb:Query"],
        resources: [
          blogPostsTable.tableArn,
          `${blogPostsTable.tableArn}/index/CreatedAtIndex`,
          `${blogPostsTable.tableArn}/index/PublishedIndex`
        ]
      })
    )

    const lambdaConfigs = [
      {
        name: "GetPost",
        root: postRoot,
        path: "{id}",
        method: "GET",
        zipFile: "lambdas/get-post.zip",
        role: getPostRole
      },
      {
        name: "GetPosts",
        root: api.root,
        path: "posts",
        method: "GET",
        zipFile: "lambdas/get-posts.zip",
        role: getPostRole
      }
    ]

    lambdaConfigs.forEach((config) => {
      const lambdaFunction = new lambda.Function(this, `${config.name}Lambda${stage}`, {
        role: config.role,
        runtime: lambda.Runtime.PROVIDED_AL2023,
        handler: "bootstrap",
        code: lambda.Code.fromAsset(config.zipFile),
        environment: {
          BLOG_POSTS_TABLE: blogPostsTable.tableName,
          BLOG_CONTENT_BUCKET: blogContentBucket.bucketName
        }
      })
      const apiResource = config.root.addResource(config.path)
      apiResource.addMethod(config.method, new apigateway.LambdaIntegration(lambdaFunction))
    })
  }
}
