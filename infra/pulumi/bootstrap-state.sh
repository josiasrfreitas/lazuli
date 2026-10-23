#!/usr/bin/env bash
set -euo pipefail

# The state bucket must exist before Pulumi can use it as a backend.
aws_profile="${AWS_PROFILE:-lazuli}"
aws_region="us-east-2"
account_id="413781344359"
bucket="lazuli-pulumi-state-${account_id}-${aws_region}"

actual_account="$(aws sts get-caller-identity --profile "$aws_profile" --query Account --output text)"
if [[ "$actual_account" != "$account_id" ]]; then
  echo "Expected AWS account $account_id, got $actual_account" >&2
  exit 1
fi

if ! aws s3api head-bucket --profile "$aws_profile" --region "$aws_region" --bucket "$bucket" 2>/dev/null; then
  aws s3api create-bucket --profile "$aws_profile" --region "$aws_region" --bucket "$bucket" \
    --object-ownership BucketOwnerEnforced \
    --create-bucket-configuration "LocationConstraint=$aws_region"
fi

aws s3api put-public-access-block --profile "$aws_profile" --region "$aws_region" --bucket "$bucket" \
  --public-access-block-configuration 'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'
aws s3api put-bucket-versioning --profile "$aws_profile" --region "$aws_region" --bucket "$bucket" \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --profile "$aws_profile" --region "$aws_region" --bucket "$bucket" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-bucket-tagging --profile "$aws_profile" --region "$aws_region" --bucket "$bucket" \
  --tagging 'TagSet=[{Key=Project,Value=lazuli},{Key=Purpose,Value=pulumi-state}]'

echo "Pulumi backend: s3://$bucket"
