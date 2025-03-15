import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as cognito from "aws-cdk-lib/aws-cognito"
import * as iam from "aws-cdk-lib/aws-iam"
import { Construct } from "constructs"

export function setupCognito(scope: Construct, stage: string) {
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

  const adminGroup = new cognito.UserPoolGroup(scope, `BlogUserPoolAdminGroup${stage}`, {
    userPool: userPool,
    groupName: "Admin",
    description: "Administrators with full API access"
  })

  const userPoolClient = new cognito.UserPoolClient(scope, `BlogUserPoolClient${stage}`, {
    userPool,
    authFlows: { userPassword: true, adminUserPassword: true }
  })

  const identityPool = new cognito.CfnIdentityPool(scope, `BlogIdentityPool${stage}`, {
    allowUnauthenticatedIdentities: true,
    cognitoIdentityProviders: [
      {
        clientId: userPoolClient.userPoolClientId,
        providerName: userPool.userPoolProviderName
      }
    ]
  })

  const adminRole = new iam.Role(scope, `AdminIAMRole${stage}`, {
    roleName: `AdminIAMRole${stage}`,
    assumedBy: new iam.FederatedPrincipal(
      "cognito-identity.amazonaws.com",
      {
        StringEquals: { "cognito-identity.amazonaws.com:aud": identityPool.ref },
        "ForAnyValue:StringLike": { "cognito-identity.amazonaws.com:amr": "authenticated" }
      },
      "sts:AssumeRoleWithWebIdentity"
    )
  })

  const authorRole = new iam.Role(scope, `AuthorIAMRole${stage}`, {
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

  const guestRole = new iam.Role(scope, `GuestIamRole${stage}`, {
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

  new cognito.CfnIdentityPoolRoleAttachment(scope, `IdentityPoolRoleAttachment${stage}`, {
    identityPoolId: identityPool.ref,
    roles: {
      authenticated: authorRole.roleArn,
      unauthenticated: guestRole.roleArn
    },
    roleMappings: {
      adminMapping: {
        type: "Rules",
        ambiguousRoleResolution: "AuthenticatedRole",
        identityProvider: `${userPool.userPoolProviderName}:${userPoolClient.userPoolClientId}`,
        rulesConfiguration: {
          rules: [
            {
              claim: "cognito:groups",
              matchType: "Contains",
              value: adminGroup.groupName,
              roleArn: adminRole.roleArn
            }
          ]
        }
      }
    }
  })

  return { authorRole, guestRole, adminRole }
}
