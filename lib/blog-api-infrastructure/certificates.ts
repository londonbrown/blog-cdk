import * as acm from "aws-cdk-lib/aws-certificatemanager"
import * as route53 from "aws-cdk-lib/aws-route53"
import { Construct } from "constructs"

export function setupCertificates(
  scope: Construct,
  stage: string,
  blogDomainName: string,
  apiBlogDomainName: string,
  hostedZone: route53.IHostedZone
) {
  const primaryCertificate = new acm.Certificate(scope, `BlogCertificate${stage}`, {
    domainName: blogDomainName,
    subjectAlternativeNames: [apiBlogDomainName],
    validation: acm.CertificateValidation.fromDns(hostedZone)
  })
  return {
    primaryCertificate
  }
}
