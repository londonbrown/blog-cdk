import * as cdk from "aws-cdk-lib"
import * as iam from "aws-cdk-lib/aws-iam"
import { Construct } from "constructs"

export class BlogCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // Define GitHub OIDC Provider
    const oidcProvider = new iam.OpenIdConnectProvider(this, "GitHubOIDCProvider", {
      url: "https://token.actions.githubusercontent.com",
      clientIds: ["sts.amazonaws.com"]
    })

    // Create IAM Role for GitHub Actions
    const githubRole = new iam.Role(this, "GitHubOIDCDeployRole", {
      assumedBy: new iam.FederatedPrincipal(
          oidcProvider.openIdConnectProviderArn,
          {
            "StringEquals": {
              "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
            },
            "StringLike": {
              "token.actions.githubusercontent.com:sub": "repo:londonbrown/blog-cdk:ref:refs/heads/main"
            }
          },
          "sts:AssumeRoleWithWebIdentity"
      ),
      description: "IAM role assumed by GitHub Actions for deploying CDK"
    })

    // Attach necessary policies
    githubRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess"))
  }
}
