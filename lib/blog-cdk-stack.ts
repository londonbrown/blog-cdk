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

    // Add GitHub as the Source
    const sourceOutput = new codepipeline.Artifact()
    pipeline.addStage({
      stageName: "Source",
      actions: [
        new codepipeline_actions.GitHubSourceAction({
          actionName: "GitHubSource",
          owner: "londonbrown",
          repo: "blog-cdk",
          branch: "main",
          oauthToken: githubToken.secretValue,
          output: sourceOutput
        })
      ]
    })

    // Create a simple CodeBuild project
    const buildProject = new codebuild.PipelineProject(this, "SimpleBuildProject", {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          build: {
            commands: ['echo "Hello from CodeBuild!"']
          }
        }
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_6_0
      }
    })

    // Add "Build" stage to Pipeline
    pipeline.addStage({
      stageName: "Build",
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: "RunBuild",
          project: buildProject,
          input: sourceOutput
        })
      ]
    })
  }
}
