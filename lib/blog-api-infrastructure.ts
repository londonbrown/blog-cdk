import * as cdk from "aws-cdk-lib"
import { RemovalPolicy } from "aws-cdk-lib"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as acm from "aws-cdk-lib/aws-certificatemanager"
import * as cognito from "aws-cdk-lib/aws-cognito"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import * as iam from "aws-cdk-lib/aws-iam"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as route53 from "aws-cdk-lib/aws-route53"
import * as route53_targets from "aws-cdk-lib/aws-route53-targets"
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
    const blogDomainName = (
      stage != BlogAPIStage.PROD
        ? `${stage}.blog.${hostedZoneDomainName}`
        : `blog.${hostedZoneDomainName}`
    ).toLowerCase()
    const apiBlogDomainName = `api.${blogDomainName}`

    const hostedZone = route53.HostedZone.fromLookup(this, "BlogRootDomainHostedZone", {
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

    const userPool = new cognito.UserPool(this, `BlogUserPool${stage}`, {
      userPoolName: `BlogUserPool${stage}`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: true
      },
      autoVerify: {
        email: true
      },
      standardAttributes: {
        email: { required: true, mutable: false }
      }
    })

    const userPoolClient = new cognito.UserPoolClient(this, `BlogUserPoolClient${stage}`, {
      userPool,
      authFlows: { userPassword: true, adminUserPassword: true }
    })

    const identityPool = new cognito.CfnIdentityPool(this, `BlogIdentityPool${stage}`, {
      allowUnauthenticatedIdentities: true,
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName
        }
      ]
    })

    const authorRole = new iam.Role(this, `AuthorIAMRole${stage}`, {
      roleName: `AuthorIAMRole${stage}`,
      assumedBy: new iam.FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: { "cognito-identity.amazonaws.com:aud": identityPool.ref },
          "ForAnyValue:StringLike": { "cognito-identity.amazonaws.com:amr": "authenticated" }
        },
        "sts:AssumeRoleWithWebIdentity"
      )
    })

    const guestRole = new iam.Role(this, `GuestIamRole${stage}`, {
      roleName: `GuestIamRole${stage}`,
      assumedBy: new iam.FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: { "cognito-identity.amazonaws.com:aud": identityPool.ref },
          "ForAnyValue:StringLike": { "cognito-identity.amazonaws.com:amr": "unauthenticated" }
        },
        "sts:AssumeRoleWithWebIdentity"
      )
    })

    new cognito.CfnIdentityPoolRoleAttachment(this, `IdentityPoolRoleAttachment${stage}`, {
      identityPoolId: identityPool.ref,
      roles: {
        authenticated: authorRole.roleArn,
        unauthenticated: guestRole.roleArn
      }
    })

    const api = new apigateway.RestApi(this, `BlogAPIGateway${stage}`, {
      restApiName: `Blog API (${stage})`,
      description: "API Gateway for the blog service"
    })

    const customDomain = new apigateway.DomainName(this, `BlogAPIDomain${stage}`, {
      domainName: apiBlogDomainName,
      certificate: certificate
    })

    new apigateway.BasePathMapping(this, `BlogAPIBasePathMapping${stage}`, {
      domainName: customDomain,
      restApi: api,
      stage: api.deploymentStage
    })

    new route53.ARecord(this, `BlogAPIAliasRecord${stage}`, {
      zone: hostedZone,
      recordName: apiBlogDomainName,
      target: route53.RecordTarget.fromAlias(new route53_targets.ApiGatewayDomain(customDomain))
    })

    const apiAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      `BlogAPIAuthorizer${stage}`,
      {
        cognitoUserPools: [userPool]
      }
    )

    const postRoot = api.root.addResource("post")

    const lambdaRoleProps = {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
      ]
    }

    const getPostRole = new iam.Role(this, `GetPostLambdaRole${stage}`, lambdaRoleProps)

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

    const createPostRole = new iam.Role(this, `CreatePostLambdaRole${stage}`, lambdaRoleProps)

    createPostRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:PutItem"],
        resources: [blogPostsTable.tableArn]
      })
    )

    const guestApiMethodOptions: apigateway.MethodOptions = {
      authorizationType: apigateway.AuthorizationType.IAM
    }

    const cognitoApiMethodOptions: apigateway.MethodOptions = {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: apiAuthorizer
    }

    const lambdaConfigs = [
      {
        name: "GetPost",
        root: postRoot,
        path: "{id}",
        method: "GET",
        zipFile: "lambdas/get-post.zip",
        role: getPostRole,
        methodOptions: {
          ...guestApiMethodOptions
        },
        authRole: guestRole
      },
      {
        name: "GetPosts",
        root: api.root,
        path: "posts",
        method: "GET",
        zipFile: "lambdas/get-posts.zip",
        role: getPostRole,
        methodOptions: {
          ...guestApiMethodOptions
        },
        authRole: guestRole
      },
      {
        name: "CreatePost",
        root: postRoot,
        method: "POST",
        zipFile: "lambdas/create-post.zip",
        role: createPostRole,
        methodOptions: {
          ...cognitoApiMethodOptions
        },
        authRole: authorRole
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
      const apiResource = config.path ? config.root.addResource(config.path) : config.root
      const lambdaIntegration = new apigateway.LambdaIntegration(lambdaFunction)
      const method = apiResource.addMethod(config.method, lambdaIntegration, config.methodOptions)

      config.authRole.addToPolicy(
        new iam.PolicyStatement({
          actions: ["execute-api:Invoke"],
          resources: [method.methodArn]
        })
      )
    })
  }
}
