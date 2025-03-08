import * as cdk from "aws-cdk-lib"
import * as codebuild from "aws-cdk-lib/aws-codebuild"
import * as codepipeline from "aws-cdk-lib/aws-codepipeline"
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions"
import * as iam from "aws-cdk-lib/aws-iam"
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager"
import { Construct } from "constructs"

export class BlogCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // Fetch the GitHub token from AWS Secrets Manager
    const githubToken = secretsmanager.Secret.fromSecretNameV2(this, "GitHubToken", "GitHubToken")

    // Self-mutation role
    const pipelineRole = new iam.Role(this, "PipelineRole", {
      assumedBy: new iam.ServicePrincipal("codepipeline.amazonaws.com")
    })

    pipelineRole.assumeRolePolicy?.addStatements(
      new iam.PolicyStatement({
        actions: ["sts:AssumeRole"],
        principals: [new iam.ServicePrincipal("codebuild.amazonaws.com")]
      })
    )

    // Attach SSM read permissions to allow bootstrap stack access
    pipelineRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [`arn:aws:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:parameter/cdk-bootstrap/*`]
      })
    )

    // Define CodePipeline
    const pipeline = new codepipeline.Pipeline(this, "ChaimCodesBlogPipeline", {
      pipelineName: "ChaimCodesBlogPipeline",
      role: pipelineRole
    })

    // Add GitHub repos as Source artifacts
    const cdkSource = new codepipeline.Artifact("CDKSource")
    const lambdaSource = new codepipeline.Artifact("LambdasSource")

    pipeline.addStage({
      stageName: "Source",
      actions: [
        new codepipeline_actions.GitHubSourceAction({
          actionName: "GitHubSource-CDK",
          owner: "londonbrown",
          repo: "blog-cdk",
          branch: "main",
          oauthToken: githubToken.secretValue,
          output: cdkSource
        }),
        new codepipeline_actions.GitHubSourceAction({
          actionName: "GitHubSource-Lambdas",
          owner: "londonbrown",
          repo: "blog-lambdas",
          branch: "main",
          oauthToken: githubToken.secretValue,
          output: lambdaSource
        })
      ]
    })

    // Self-mutation stage
    pipeline.addStage({
      stageName: "SelfMutate",
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: "Self-Mutate",
          role: pipelineRole,
          project: new codebuild.PipelineProject(this, "SelfMutationProject", {
            buildSpec: codebuild.BuildSpec.fromObject({
              version: "0.2",
              phases: {
                install: {
                  commands: ["npm install -g aws-cdk", "npm install"]
                },
                build: {
                  commands: ["npx cdk deploy --require-approval never"]
                }
              }
            })
          }),
          input: cdkSource
        })
      ]
    })

    // Add Lambda Build stage
    const lambdaBuildOutput = new codepipeline.Artifact("LambdaBuildOutput")

    pipeline.addStage({
      stageName: "BuildLambdas",
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: "BuildLambdaArtifacts",
          project: new codebuild.PipelineProject(this, "LambdaBuildProject", {
            buildSpec: codebuild.BuildSpec.fromObject({
              version: "0.2",
              phases: {
                install: {
                  commands: ["echo 'Using Docker for Rust Lambda builds'"]
                },
                build: {
                  commands: [
                    "docker run --rm -v $(pwd):/workspace -w /workspace ghcr.io/cargo-lambda/cargo-lambda:latest cargo lambda build --release --output-format zip"
                  ]
                }
              },
              artifacts: {
                files: ["target/lambda/**/*.zip"]
              }
            }),
            environment: {
              buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
              privileged: true
            }
          }),
          input: lambdaSource,
          outputs: [lambdaBuildOutput]
        })
      ]
    })
  }
}
