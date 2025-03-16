import * as cognito from "aws-cdk-lib/aws-cognito"
import { LambdaVersion, UserPoolOperation } from "aws-cdk-lib/aws-cognito"
import { Construct } from "constructs"

import { createLambdaFunction } from "./lambdas/lambda-config"

export function setupCognito(scope: Construct, stage: string, apiBlogDomain: string) {
  const userPool = new cognito.UserPool(scope, `BlogUserPool${stage}`, {
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

  const preTokenGenerationLambda = createLambdaFunction(
    scope,
    `BlogUserPoolPreTokenGeneration${stage}`,
    {
      lambdaPath: "lambdas/pretoken-generation.zip",
      rolePermissions: {
        policyStatements: []
      }
    }
  )

  userPool.addTrigger(
    UserPoolOperation.PRE_TOKEN_GENERATION_CONFIG,
    preTokenGenerationLambda,
    LambdaVersion.V2_0
  )

  const postReadScope = new cognito.ResourceServerScope({
    scopeName: "post.read",
    scopeDescription: "Read blog posts"
  })
  const postWriteScope = new cognito.ResourceServerScope({
    scopeName: "post.write",
    scopeDescription: "Create blog posts"
  })
  const postDeleteScope = new cognito.ResourceServerScope({
    scopeName: "post.delete",
    scopeDescription: "Delete blog posts"
  })
  const commentReadScope = new cognito.ResourceServerScope({
    scopeName: "comment.read",
    scopeDescription: "Create comments"
  })
  const commentWriteScope = new cognito.ResourceServerScope({
    scopeName: "comment.write",
    scopeDescription: "Create comments"
  })
  const commentDeleteScope = new cognito.ResourceServerScope({
    scopeName: "comment.delete",
    scopeDescription: "Delete comments"
  })

  const resourceServer = userPool.addResourceServer(`BlogUserPoolResourceServer${stage}`, {
    userPoolResourceServerName: `Blog API - ${stage}`,
    identifier: `https://${apiBlogDomain}`,
    scopes: [
      postReadScope,
      postWriteScope,
      postDeleteScope,
      commentReadScope,
      commentWriteScope,
      commentDeleteScope
    ]
  })

  const adminClient = userPool.addClient(`BlogAdminClient${stage}`, {
    authFlows: { userPassword: true, adminUserPassword: true },
    oAuth: {
      scopes: [
        cognito.OAuthScope.resourceServer(resourceServer, postReadScope),
        cognito.OAuthScope.resourceServer(resourceServer, postWriteScope),
        cognito.OAuthScope.resourceServer(resourceServer, postDeleteScope),
        cognito.OAuthScope.resourceServer(resourceServer, commentReadScope),
        cognito.OAuthScope.resourceServer(resourceServer, commentWriteScope),
        cognito.OAuthScope.resourceServer(resourceServer, commentDeleteScope)
      ]
    }
  })

  const authorClient = userPool.addClient(`BlogAuthorClient${stage}`, {
    authFlows: { userPassword: true, adminUserPassword: true },
    oAuth: {
      scopes: [
        cognito.OAuthScope.resourceServer(resourceServer, postReadScope),
        cognito.OAuthScope.resourceServer(resourceServer, postWriteScope),
        cognito.OAuthScope.resourceServer(resourceServer, commentReadScope),
        cognito.OAuthScope.resourceServer(resourceServer, commentWriteScope),
        cognito.OAuthScope.resourceServer(resourceServer, commentDeleteScope)
      ]
    }
  })

  const commenterClient = userPool.addClient(`BlogCommenterClient${stage}`, {
    authFlows: { userPassword: true, adminUserPassword: true },
    oAuth: {
      scopes: [
        cognito.OAuthScope.resourceServer(resourceServer, postReadScope),
        cognito.OAuthScope.resourceServer(resourceServer, commentReadScope),
        cognito.OAuthScope.resourceServer(resourceServer, commentWriteScope),
        cognito.OAuthScope.resourceServer(resourceServer, commentDeleteScope)
      ]
    }
  })

  const guestClient = userPool.addClient(`BlogGuestClient${stage}`, {
    authFlows: { userPassword: true, adminUserPassword: true },
    oAuth: {
      scopes: [
        cognito.OAuthScope.resourceServer(resourceServer, postReadScope),
        cognito.OAuthScope.resourceServer(resourceServer, commentReadScope)
      ]
    }
  })

  return { userPool, adminClient, authorClient, commenterClient, guestClient }
}
