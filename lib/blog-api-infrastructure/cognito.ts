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

  const guestUser = new cognito.CfnUserPoolUser(scope, `BlogGuestUser${stage}`, {
    username: "guest-user",
    userPoolId: userPool.userPoolId,
    userAttributes: [
      {
        name: "email",
        value: `guest-user@${apiBlogDomain}`
      }
    ]
  })

  const adminGroup = userPool.addGroup(`BlogAdminUserGroup${stage}`, {
    groupName: "admin",
    precedence: 0
  })

  const authorGroup = userPool.addGroup(`BlogAuthorUserGroup${stage}`, {
    groupName: "author",
    precedence: 1
  })

  const commentGroup = userPool.addGroup(`BlogCommenterUserGroup${stage}`, {
    groupName: "commenter",
    precedence: 2
  })

  const guestGroup = userPool.addGroup(`BlogGuestUserGroup${stage}`, {
    groupName: "guest",
    precedence: 99
  })

  const preTokenGenerationLambda = createLambdaFunction(
    scope,
    `BlogUserPoolPreTokenGeneration${stage}`,
    {
      lambdaPath: "lambdas/pretoken-generation.zip",
      rolePermissions: {
        policyStatements: []
      },
      environment: {
        API_BLOG_DOMAIN: apiBlogDomain
      }
    }
  )

  userPool.addTrigger(
    UserPoolOperation.PRE_TOKEN_GENERATION_CONFIG,
    preTokenGenerationLambda,
    LambdaVersion.V2_0
  )

  const adminReadScope = new cognito.ResourceServerScope({
    scopeName: "admin.read",
    scopeDescription: "Admin read auth scope"
  })

  const adminWriteScope = new cognito.ResourceServerScope({
    scopeName: "admin.write",
    scopeDescription: "Admin write auth scope"
  })

  const adminDeleteScope = new cognito.ResourceServerScope({
    scopeName: "admin.delete",
    scopeDescription: "Admin write auth scope"
  })

  const authorReadScope = new cognito.ResourceServerScope({
    scopeName: "author.read",
    scopeDescription: "Author read auth scope"
  })

  const authorWriteScope = new cognito.ResourceServerScope({
    scopeName: "author.write",
    scopeDescription: "Author write auth scope"
  })

  const authorDeleteScope = new cognito.ResourceServerScope({
    scopeName: "author.delete",
    scopeDescription: "Author delete auth scope"
  })

  const commenterReadScope = new cognito.ResourceServerScope({
    scopeName: "commenter.read",
    scopeDescription: "Commenter read auth scope"
  })

  const commenterWriteScope = new cognito.ResourceServerScope({
    scopeName: "commenter.write",
    scopeDescription: "Commenter write auth scope"
  })

  const commenterDeleteScope = new cognito.ResourceServerScope({
    scopeName: "commenter.delete",
    scopeDescription: "Commenter delete auth scope"
  })

  const guestReadScope = new cognito.ResourceServerScope({
    scopeName: "guest.read",
    scopeDescription: "Guest read auth scope"
  })

  const guestWriteScope = new cognito.ResourceServerScope({
    scopeName: "guest.write",
    scopeDescription: "Guest write auth scope"
  })

  const guestDeleteScope = new cognito.ResourceServerScope({
    scopeName: "guest.delete",
    scopeDescription: "Guest delete auth scope"
  })

  const resourceServer = userPool.addResourceServer(`BlogUserPoolResourceServer${stage}`, {
    userPoolResourceServerName: `Blog API - ${stage}`,
    identifier: `https://${apiBlogDomain}`,
    scopes: [
      adminReadScope,
      adminWriteScope,
      adminDeleteScope,
      authorReadScope,
      authorWriteScope,
      authorDeleteScope,
      commenterReadScope,
      commenterWriteScope,
      commenterDeleteScope,
      guestReadScope,
      guestWriteScope,
      guestDeleteScope
    ]
  })

  const adminClient = userPool.addClient(`BlogAdminClient${stage}`, {
    authFlows: { userPassword: true, adminUserPassword: true },
    oAuth: {
      scopes: [
        cognito.OAuthScope.resourceServer(resourceServer, adminReadScope),
        cognito.OAuthScope.resourceServer(resourceServer, adminWriteScope),
        cognito.OAuthScope.resourceServer(resourceServer, adminDeleteScope)
      ]
    }
  })

  const authorClient = userPool.addClient(`BlogAuthorClient${stage}`, {
    authFlows: { userPassword: true, adminUserPassword: true },
    oAuth: {
      scopes: [
        cognito.OAuthScope.resourceServer(resourceServer, authorReadScope),
        cognito.OAuthScope.resourceServer(resourceServer, authorWriteScope),
        cognito.OAuthScope.resourceServer(resourceServer, authorDeleteScope)
      ]
    }
  })

  const commenterClient = userPool.addClient(`BlogCommenterClient${stage}`, {
    authFlows: { userPassword: true, adminUserPassword: true },
    oAuth: {
      scopes: [
        cognito.OAuthScope.resourceServer(resourceServer, commenterReadScope),
        cognito.OAuthScope.resourceServer(resourceServer, commenterWriteScope),
        cognito.OAuthScope.resourceServer(resourceServer, commenterDeleteScope)
      ]
    }
  })

  const guestClient = userPool.addClient(`BlogGuestClient${stage}`, {
    authFlows: { userPassword: true, adminUserPassword: true },
    oAuth: {
      scopes: [
        cognito.OAuthScope.resourceServer(resourceServer, guestReadScope),
        cognito.OAuthScope.resourceServer(resourceServer, guestWriteScope),
        cognito.OAuthScope.resourceServer(resourceServer, guestDeleteScope)
      ]
    }
  })

  return { userPool, adminClient, authorClient, commenterClient, guestUser, guestClient }
}
