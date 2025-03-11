#!/usr/bin/env node
import * as cdk from "aws-cdk-lib"

import { BlogAPIInfrastructure, BlogAPIStage } from "../lib/blog-api-infrastructure"
import { BlogGitHubStagingInfrastructure } from "../lib/blog-git-hub-staging-infrastructure"

const app = new cdk.App()
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
new BlogGitHubStagingInfrastructure(app, "BlogGitHubStagingInfrastructure", { env })
new BlogAPIInfrastructure(app, "BlogAPIInfrastructureBeta", {
  stage: BlogAPIStage.BETA,
  env
})
new BlogAPIInfrastructure(app, "BlogAPIInfrastructureProd", {
  stage: BlogAPIStage.PROD,
  env
})
