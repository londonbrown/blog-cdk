import * as cdk from "aws-cdk-lib"
import * as codebuild from "aws-cdk-lib/aws-codebuild"
import * as codepipeline from "aws-cdk-lib/aws-codepipeline"
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions"
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager"
import { Construct } from "constructs"

export class BlogCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // Fetch the GitHub token from AWS Secrets Manager
    const githubToken = secretsmanager.Secret.fromSecretNameV2(this, "GitHubToken", "GitHubToken")

    // Define CodePipeline
    const pipeline = new codepipeline.Pipeline(this, "ChaimCodesBlogPipeline", {
      pipelineName: "ChaimCodesBlogPipeline"
    })

    // Add GitHub repos as Source artifacts
    const cdkSourceOutput = new codepipeline.Artifact("CDKSource")
    const lambdasSourceOutput = new codepipeline.Artifact("LambdasSource")

    pipeline.addStage({
      stageName: "Source",
      actions: [
        new codepipeline_actions.GitHubSourceAction({
          actionName: "GitHubSource-CDK",
          owner: "londonbrown",
          repo: "blog-cdk",
          branch: "main",
          oauthToken: githubToken.secretValue,
          output: cdkSourceOutput
        }),
        new codepipeline_actions.GitHubSourceAction({
          actionName: "GitHubSource-Lambdas",
          owner: "londonbrown",
          repo: "blog-lambdas",
          branch: "main",
          oauthToken: githubToken.secretValue,
          output: lambdasSourceOutput
        })
      ]
    })

    // Create a CodeBuild step to compile and package all Lambda functions.
    const lambdaBuildProject = new codebuild.PipelineProject(this, "LambdaBuildProject", {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            commands: ["echo 'Using prebuild Rust Lambda Docker image'"]
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
    })

    // Add Lambda Build stage
    const lambdaBuildOutput = new codepipeline.Artifact("LambdaBuildOutput")
    pipeline.addStage({
      stageName: "Build-Lambda",
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: "BuildLambda",
          project: lambdaBuildProject,
          input: lambdasSourceOutput,
          outputs: [lambdaBuildOutput]
        })
      ]
    })
  }
}
