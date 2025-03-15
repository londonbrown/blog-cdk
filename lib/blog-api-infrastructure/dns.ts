import * as route53 from "aws-cdk-lib/aws-route53"
import { Construct } from "constructs"

import { BlogAPIStage } from "../blog-api-infrastructure"

export function setupDns(scope: Construct, stage: string, rootDomainName: string) {
  const blogDomainName = (
    stage != BlogAPIStage.PROD ? `${stage}.blog.${rootDomainName}` : `blog.${rootDomainName}`
  ).toLowerCase()
  const apiBlogDomainName = `api.${blogDomainName}`

  const hostedZone = route53.HostedZone.fromLookup(scope, "BlogRootDomainHostedZone", {
    domainName: rootDomainName
  })

  return { blogDomainName, apiBlogDomainName, hostedZone }
}
