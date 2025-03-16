import * as cdk from "aws-cdk-lib"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as acm from "aws-cdk-lib/aws-certificatemanager"
import * as cognito from "aws-cdk-lib/aws-cognito"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import * as iam from "aws-cdk-lib/aws-iam"
import * as route53 from "aws-cdk-lib/aws-route53"
import * as route53_targets from "aws-cdk-lib/aws-route53-targets"
import * as s3 from "aws-cdk-lib/aws-s3"
import { Construct } from "constructs"

import { createCognitoAuthorizerLambda } from "./lambdas/cognito-authorizer"
import { createCreatePostLambda } from "./lambdas/create-post"
import { createDeletePostLambda } from "./lambdas/delete-post"
import { createGetPostLambda } from "./lambdas/get-post"
import { createGetPostsLambda } from "./lambdas/get-posts"

export function setupApiGateway(
  scope: Construct,
  stage: string,
  hostedZone: route53.IHostedZone,
  apiBlogDomainName: string,
  primaryCertificate: acm.Certificate,
  userPool: cognito.UserPool,
  adminClient: cognito.UserPoolClient,
  authorClient: cognito.UserPoolClient,
  commenterClient: cognito.UserPoolClient,
  guestClient: cognito.UserPoolClient,
  bucket: s3.Bucket,
  table: dynamodb.Table
): apigateway.RestApi {
  const api = new apigateway.RestApi(scope, `BlogAPIGateway${stage}`, {
    restApiName: `Blog API (${stage})`,
    description: "API Gateway for the blog service"
  })

  const customDomain = new apigateway.DomainName(scope, `BlogAPIDomain${stage}`, {
    domainName: apiBlogDomainName,
    certificate: primaryCertificate
  })

  new apigateway.BasePathMapping(scope, `BlogAPIBasePathMapping${stage}`, {
    domainName: customDomain,
    restApi: api,
    stage: api.deploymentStage
  })

  new route53.ARecord(scope, `BlogAPIAliasRecord${stage}`, {
    zone: hostedZone,
    recordName: apiBlogDomainName,
    target: route53.RecordTarget.fromAlias(new route53_targets.ApiGatewayDomain(customDomain))
  })

  const authorizerLambda = createCognitoAuthorizerLambda(
    scope,
    stage,
    userPool,
    api,
    adminClient,
    authorClient,
    commenterClient,
    guestClient
  )

  const apiAuthorizer = new apigateway.RequestAuthorizer(scope, `APIAuthorizer${stage}`, {
    handler: authorizerLambda,
    identitySources: [apigateway.IdentitySource.header("Authorization")],
    resultsCacheTtl: cdk.Duration.minutes(5)
  })

  const postRoot = api.root.addResource("post")
  const postById = postRoot.addResource("{id}")
  const posts = api.root.addResource("posts")

  const getPostLambda = createGetPostLambda(scope, stage, table, bucket)
  const getPostsLambda = createGetPostsLambda(scope, stage, table)
  const createPostLambda = createCreatePostLambda(scope, stage, table, bucket)
  const deletePostLambda = createDeletePostLambda(scope, stage, table, bucket)

  const getPostMethod = postById.addMethod("GET", new apigateway.LambdaIntegration(getPostLambda), {
    authorizationType: apigateway.AuthorizationType.CUSTOM,
    authorizer: apiAuthorizer,
    authorizationScopes: [
      `https://${apiBlogDomainName}/post.read`,
      `https://${apiBlogDomainName}/comment.read`
    ]
  })

  const getPostsMethod = posts.addMethod("GET", new apigateway.LambdaIntegration(getPostsLambda), {
    authorizationType: apigateway.AuthorizationType.CUSTOM,
    authorizer: apiAuthorizer,
    authorizationScopes: [
      `https://${apiBlogDomainName}/post.read`,
      `https://${apiBlogDomainName}/comment.read`
    ]
  })

  const createPostMethod = postRoot.addMethod(
    "POST",
    new apigateway.LambdaIntegration(createPostLambda),
    {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizationScopes: [`https://${apiBlogDomainName}/post.write`]
    }
  )

  const deletePostMethod = postById.addMethod(
    "DELETE",
    new apigateway.LambdaIntegration(deletePostLambda),
    {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizationScopes: [
        `https://${apiBlogDomainName}/post.delete`,
        `https://${apiBlogDomainName}/comment.delete`
      ]
    }
  )

  return api
}
