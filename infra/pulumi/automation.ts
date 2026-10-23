import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

// Bootstrap locally. Application/infra CI cannot edit these roles or their trust.
export function createAutomation() {
  const account = "413781344359";
  const region = "us-east-2";
  const repository = "josiasrfreitas/lazuli";
  const backend = `arn:aws:s3:::lazuli-pulumi-state-${account}-${region}`;
  const config = new pulumi.Config();
  const existingProvider = config.get("githubOidcProviderArn");
  const providerArn = existingProvider
    ? pulumi.output(existingProvider)
    : new aws.iam.OpenIdConnectProvider(
        "github",
        {
          url: "https://token.actions.githubusercontent.com",
          clientIdLists: ["sts.amazonaws.com"],
        },
        { protect: true },
      ).arn;
  type Statement = {
    Effect: "Allow";
    Action: string[];
    Resource: string | string[];
    Condition?: Record<string, Record<string, string>>;
  };
  const allow = (
    Action: string[],
    Resource: string | string[],
    Condition?: Statement["Condition"],
  ): Statement => ({ Effect: "Allow", Action, Resource, ...(Condition ? { Condition } : {}) });
  function role(name: string, subject: string, statements: Statement[]) {
    const identity = new aws.iam.Role(
      name,
      {
        name: `lazuli-github-${name}`,
        maxSessionDuration: 3600,
        assumeRolePolicy: providerArn.apply((arn) =>
          JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: { Federated: arn },
                Action: "sts:AssumeRoleWithWebIdentity",
                Condition: {
                  StringEquals: {
                    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
                    "token.actions.githubusercontent.com:sub": `repo:${repository}:${subject}`,
                  },
                },
              },
            ],
          }),
        ),
        tags: { Project: "lazuli", Environment: "automation" },
      },
      { protect: true },
    );
    new aws.iam.RolePolicy(
      name,
      {
        role: identity.name,
        policy: JSON.stringify({ Version: "2012-10-17", Statement: statements }),
      },
      { protect: true },
    );
    return identity.arn;
  }
  const stateRead = [
    allow(["s3:ListBucket", "s3:GetBucketLocation"], backend),
    allow(["s3:GetObject"], `${backend}/.pulumi/*`),
    // DIY backend leases are the only writes permitted to the preview role.
    allow(["s3:PutObject", "s3:DeleteObject"], `${backend}/.pulumi/locks/*`),
  ];
  const reads = [
    allow(
      [
        "ec2:Describe*",
        "rds:Describe*",
        "rds:ListTagsForResource",
        "ecr:Describe*",
        "ecr:GetLifecyclePolicy",
        "ecr:GetRepositoryPolicy",
        "ecr:ListTagsForResource",
      ],
      "*",
    ),
    allow(
      [
        "iam:GetRole",
        "iam:GetRolePolicy",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "iam:GetInstanceProfile",
        "iam:GetOpenIDConnectProvider",
        "iam:ListOpenIDConnectProviderTags",
      ],
      `arn:aws:iam::${account}:*`,
    ),
    allow(
      [
        "s3:GetBucket*",
        "s3:GetEncryptionConfiguration",
        "s3:GetLifecycleConfiguration",
        "s3:GetAccelerateConfiguration",
        "s3:GetReplicationConfiguration",
        "s3:GetBucketObjectLockConfiguration",
      ],
      "arn:aws:s3:::lazuli-*",
    ),
    allow(
      ["ssm:GetParameter", "ssm:GetParameters", "ssm:ListTagsForResource"],
      `arn:aws:ssm:${region}:${account}:parameter/lazuli/*`,
    ),
    allow(["budgets:ViewBudget"], `arn:aws:budgets::${account}:budget/lazuli-monthly-account`),
  ];
  const previewRoleArn = role("preview", "pull_request", [...stateRead, ...reads]);
  const applyRoleArn = role("infra-apply", "environment:infra-apply", [
    ...stateRead,
    ...reads,
    allow(
      ["s3:PutObject", "s3:DeleteObject"],
      [
        `${backend}/.pulumi/stacks/lazuli/shared*`,
        `${backend}/.pulumi/stacks/lazuli/staging*`,
        `${backend}/.pulumi/stacks/lazuli/prod*`,
        `${backend}/.pulumi/stacks/lazuli/billing*`,
        `${backend}/.pulumi/history/lazuli/*`,
        `${backend}/.pulumi/backups/lazuli/*`,
      ],
    ),
    // VPC/EC2 and RDS provision many resource types, some without resource-level IAM.
    // This dedicated-account provisioning role is intentionally broader than app deploy.
    allow(["ec2:*", "rds:*"], "*", { StringEquals: { "aws:RequestedRegion": region } }),
    allow(
      ["s3:*"],
      ["arn:aws:s3:::lazuli-*-private-files-*", "arn:aws:s3:::lazuli-*-private-files-*/*"],
    ),
    allow(["ecr:*"], `arn:aws:ecr:${region}:${account}:repository/lazuli/*`),
    allow(
      [
        "ssm:PutParameter",
        "ssm:DeleteParameter",
        "ssm:AddTagsToResource",
        "ssm:RemoveTagsFromResource",
      ],
      `arn:aws:ssm:${region}:${account}:parameter/lazuli/*`,
    ),
    allow(
      [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:UpdateRole",
        "iam:UpdateAssumeRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:TagRole",
        "iam:UntagRole",
      ],
      `arn:aws:iam::${account}:role/runtime-*`,
    ),
    allow(
      [
        "iam:CreateInstanceProfile",
        "iam:DeleteInstanceProfile",
        "iam:AddRoleToInstanceProfile",
        "iam:RemoveRoleFromInstanceProfile",
        "iam:TagInstanceProfile",
        "iam:UntagInstanceProfile",
      ],
      `arn:aws:iam::${account}:instance-profile/runtime-*`,
    ),
    allow(["iam:PassRole"], `arn:aws:iam::${account}:role/runtime-*`, {
      StringEquals: { "iam:PassedToService": "ec2.amazonaws.com" },
    }),
    allow(["budgets:ModifyBudget"], `arn:aws:budgets::${account}:budget/lazuli-monthly-account`),
  ]);
  const deployRoleArns = Object.fromEntries(
    (["staging", "prod"] as const).map((environment) => {
      const instance = `arn:aws:ec2:${region}:${account}:instance/*`;
      const tagged = {
        StringEquals: {
          "aws:ResourceTag/Project": "lazuli",
          "aws:ResourceTag/Environment": environment,
        },
      };
      const arn = role(`deploy-${environment}`, `environment:app-${environment}`, [
        allow(
          [
            "ec2:DescribeInstances",
            "ec2:DescribeInstanceStatus",
            "ssm:DescribeInstanceInformation",
            "ssm:GetCommandInvocation",
            "ssm:ListCommands",
          ],
          "*",
        ),
        allow(["ssm:SendCommand", "ssm:StartSession"], instance, tagged),
        allow(["ssm:SendCommand"], `arn:aws:ssm:${region}::document/AWS-RunShellScript`),
        allow(
          ["ssm:StartSession"],
          `arn:aws:ssm:${region}::document/AWS-StartPortForwardingSessionToRemoteHost`,
        ),
        allow(["ssm:TerminateSession"], `arn:aws:ssm:${region}:${account}:session/*`),
        allow(
          ["ssm:GetParameter"],
          `arn:aws:ssm:${region}:${account}:parameter/lazuli/${environment}/migration/DATABASE_URL`,
        ),
        allow(["ecr:GetAuthorizationToken"], "*"),
        allow(
          [
            "ecr:BatchCheckLayerAvailability",
            "ecr:BatchGetImage",
            "ecr:GetDownloadUrlForLayer",
            "ecr:InitiateLayerUpload",
            "ecr:UploadLayerPart",
            "ecr:CompleteLayerUpload",
            "ecr:PutImage",
          ],
          `arn:aws:ecr:${region}:${account}:repository/lazuli/${environment}`,
        ),
      ]);
      return [environment, arn];
    }),
  );
  return { previewRoleArn, applyRoleArn, deployRoleArns };
}
