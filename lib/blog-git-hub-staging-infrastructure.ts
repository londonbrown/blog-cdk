import * as cdk from "aws-cdk-lib"
import * as iam from "aws-cdk-lib/aws-iam"
import * as s3 from "aws-cdk-lib/aws-s3"
import { Construct } from "constructs"

export class BlogGitHubStagingInfrastructure extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // Define GitHub OIDC Provider
    const oidcProvider = new iam.OpenIdConnectProvider(this, "BlogCDKGitHubOIDCProvider", {
      url: "https://token.actions.githubusercontent.com",
      clientIds: ["sts.amazonaws.com"]
    })

    // Create IAM Role for GitHub Actions
    const githubRole = new iam.Role(this, "BlogCDKGitHubOIDCDeployRole", {
      assumedBy: new iam.FederatedPrincipal(
        oidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
          },
          StringLike: {
            "token.actions.githubusercontent.com:sub": "repo:londonbrown/blog-cdk:*"
          }
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
      roleName: "BlogCDKGitHubOIDCDeployRole",
      description: "IAM role assumed by GitHub Actions for deploying CDK"
    })

    // Attach necessary policies
    githubRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess"))

    const bucketName = process.env.CDK_STAGING_BUCKET_NAME

    new s3.Bucket(this, "BlogCDKGitHubStagingBucket", {
      bucketName: bucketName
    })
  }
}
