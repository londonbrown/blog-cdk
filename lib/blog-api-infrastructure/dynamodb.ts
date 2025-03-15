import * as cdk from "aws-cdk-lib"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import { Construct } from "constructs"

export function setupDynamoDb(scope: Construct, stage: String): { blogPostsTable: dynamodb.Table } {
  const blogPostsTable = new dynamodb.Table(scope, `BlogPostsTable${stage}`, {
    tableName: `BlogPosts${stage}`,
    partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
    sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    removalPolicy: cdk.RemovalPolicy.RETAIN
  })

  blogPostsTable.addGlobalSecondaryIndex({
    indexName: "CreatedAtIndex",
    partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
    sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING }
  })

  blogPostsTable.addGlobalSecondaryIndex({
    indexName: "PublishedIndex",
    partitionKey: { name: "published", type: dynamodb.AttributeType.STRING },
    sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING }
  })

  new cdk.CfnOutput(scope, "BlogPostsTableName", {
    value: blogPostsTable.tableName
  })

  return { blogPostsTable }
}
