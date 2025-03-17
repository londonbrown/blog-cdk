import * as cdk from "aws-cdk-lib"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import { AuthorizationType } from "aws-cdk-lib/aws-apigateway"
import * as acm from "aws-cdk-lib/aws-certificatemanager"
import * as cognito from "aws-cdk-lib/aws-cognito"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import * as route53 from "aws-cdk-lib/aws-route53"
import * as route53_targets from "aws-cdk-lib/aws-route53-targets"
import * as s3 from "aws-cdk-lib/aws-s3"
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager"
import { Construct } from "constructs"

import { createCreatePostLambda } from "./lambdas/create-post"
import { createDeletePostLambda } from "./lambdas/delete-post"
import { createGetPostLambda } from "./lambdas/get-post"
import { createGetPostsLambda } from "./lambdas/get-posts"
import { createGuestJwtGeneratorLambda } from "./lambdas/guest-jwt-generator"

export function setupApiGateway(
  scope: Construct,
  stage: string,
  hostedZone: route53.IHostedZone,
  apiBlogDomainName: string,
  primaryCertificate: acm.Certificate,
  userPool: cognito.UserPool,
  guestClient: cognito.UserPoolClient,
  guestUserPasswordSecret: secretsmanager.Secret,
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

  const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(
    scope,
    `BlogCognitoAuthorizer${stage}`,
    {
      cognitoUserPools: [userPool],
      identitySource: apigateway.IdentitySource.header("Authorization")
    }
  )

  const authRoot = api.root.addResource("auth")
  const guestTokenRoot = authRoot.addResource("guest-token")
  const postRoot = api.root.addResource("post")
  const postById = postRoot.addResource("{id}")
  const posts = api.root.addResource("posts")

  const guestJwtGeneratorLambda = createGuestJwtGeneratorLambda(
    scope,
    stage,
    guestClient,
    guestUserPasswordSecret
  )
  const getPostLambda = createGetPostLambda(scope, stage, table, bucket)
  const getPostsLambda = createGetPostsLambda(scope, stage, table)
  const createPostLambda = createCreatePostLambda(scope, stage, table, bucket)
  const deletePostLambda = createDeletePostLambda(scope, stage, table, bucket)

  const guestJwtGeneratorMethod = guestTokenRoot.addMethod(
    "GET",
    new apigateway.LambdaIntegration(guestJwtGeneratorLambda),
    {
      authorizationType: AuthorizationType.NONE
    }
  )

  const getPostMethod = postById.addMethod("GET", new apigateway.LambdaIntegration(getPostLambda), {
    authorizationType: apigateway.AuthorizationType.COGNITO,
    authorizer: cognitoAuthorizer,
    authorizationScopes: [
      `https://${apiBlogDomainName}/admin.read`,
      `https://${apiBlogDomainName}/author.read`,
      `https://${apiBlogDomainName}/commenter.read`,
      `https://${apiBlogDomainName}/guest.read`
    ]
  })

  const getPostsMethod = posts.addMethod("GET", new apigateway.LambdaIntegration(getPostsLambda), {
    authorizationType: apigateway.AuthorizationType.COGNITO,
    authorizer: cognitoAuthorizer,
    authorizationScopes: [
      `https://${apiBlogDomainName}/admin.read`,
      `https://${apiBlogDomainName}/author.read`,
      `https://${apiBlogDomainName}/commenter.read`,
      `https://${apiBlogDomainName}/guest.read`
    ]
  })

  const createPostMethod = postRoot.addMethod(
    "POST",
    new apigateway.LambdaIntegration(createPostLambda),
    {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: cognitoAuthorizer,
      authorizationScopes: [
        `https://${apiBlogDomainName}/admin.write`,
        `https://${apiBlogDomainName}/author.write`
      ]
    }
  )

  const deletePostMethod = postById.addMethod(
    "DELETE",
    new apigateway.LambdaIntegration(deletePostLambda),
    {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: cognitoAuthorizer,
      authorizationScopes: [`https://${apiBlogDomainName}/admin.delete`]
    }
  )

  return api
}
