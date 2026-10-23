import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

interface SharedNetwork {
  vpcId: string;
  databaseAddress: string;
  databaseSecurityGroupId: string;
  applicationSubnetIds: Record<"staging" | "prod", string>;
  clientSecurityGroupIds: Record<"staging" | "prod", string>;
}

export function createCompute(environment: "staging" | "prod", files: aws.s3.Bucket) {
  const config = new pulumi.Config();
  const tags = { Project: "lazuli", Environment: environment };
  const appUrl = config.get("appUrl");
  if (appUrl && (new URL(appUrl).protocol !== "https:" || new URL(appUrl).pathname !== "/")) {
    throw new Error("appUrl must be an HTTPS origin without a path.");
  }
  const imageRepository = new aws.ecr.Repository(
    "application-images",
    {
      name: `lazuli/${environment}`,
      imageTagMutability: "IMMUTABLE",
      imageScanningConfiguration: { scanOnPush: true },
      encryptionConfigurations: [{ encryptionType: "AES256" }],
      forceDelete: false,
      tags,
    },
    { protect: true },
  );
  const mailpitSetup =
    environment === "staging"
      ? `
docker network create lazuli
docker run -d --name mailpit --network lazuli --restart unless-stopped \\
  --publish 127.0.0.1:1025:1025 --publish 127.0.0.1:8025:8025 \\
  --env MP_MAX_MESSAGES=500 \\
  --health-cmd='wget --quiet --spider http://127.0.0.1:8025/livez || exit 1' \\
  --health-interval=15s --health-retries=5 axllent/mailpit:v1.21
`
      : "";
  const sharedStack = new pulumi.StackReference("shared");
  const network = sharedStack.requireOutput("shared") as pulumi.Output<SharedNetwork>;
  const runtimePassword = config.requireSecret("databaseRuntimePassword");
  const ownerPassword = config.requireSecret("databaseOwnerPassword");
  function databaseUrl(username: string, password: pulumi.Output<string>) {
    return pulumi
      .all([network.databaseAddress, password])
      .apply(
        ([host, value]) =>
          `postgresql://${username}:${encodeURIComponent(value)}@${host}:5432/lazuli_${environment}?sslmode=verify-full&sslrootcert=/opt/lazuli/rds-ca.pem`,
      );
  }
  const runtimeDatabase = new aws.ssm.Parameter(
    "runtime-database-url",
    {
      name: `/lazuli/${environment}/runtime/DATABASE_URL`,
      type: "SecureString",
      value: databaseUrl(`lazuli_${environment}_runtime`, runtimePassword),
      tags,
    },
    { protect: true },
  );
  const authSecret = new aws.ssm.Parameter(
    "runtime-auth-secret",
    {
      name: `/lazuli/${environment}/runtime/BETTER_AUTH_SECRET`,
      type: "SecureString",
      value: config.requireSecret("authSecret"),
      tags,
    },
    { protect: true },
  );
  const hatchetToken = config.getSecret("hatchetToken");
  const hatchetParameter = hatchetToken
    ? new aws.ssm.Parameter(
        "runtime-hatchet-token",
        {
          name: `/lazuli/${environment}/runtime/HATCHET_CLIENT_TOKEN`,
          type: "SecureString",
          value: hatchetToken,
          tags,
        },
        { protect: true },
      )
    : undefined;
  const runtimeConfig = new aws.ssm.Parameter(
    "runtime-config",
    {
      name: `/lazuli/${environment}/runtime/CONFIG`,
      type: "String",
      value: files.bucket.apply((bucket) =>
        JSON.stringify({
          NODE_ENV: "production",
          LAZULI_ENV: environment,
          AWS_REGION: "us-east-2",
          S3_BUCKET: bucket,
          HATCHET_CLIENT_NAMESPACE: `lazuli-${environment}`,
          ...(appUrl ? { APP_URL: appUrl, BETTER_AUTH_URL: appUrl } : {}),
          EMAIL_FROM: config.get("emailFrom") ?? "Lazuli <noreply@example.com>",
          ...(environment === "staging" ? { SMTP_HOST: "mailpit", SMTP_PORT: "1025" } : {}),
        }),
      ),
      tags,
    },
    { protect: true },
  );
  const resendApiKey = environment === "prod" ? config.getSecret("resendApiKey") : undefined;
  const optionalSecrets = resendApiKey
    ? [
        new aws.ssm.Parameter(
          "runtime-resendApiKey",
          {
            name: `/lazuli/${environment}/runtime/RESEND_API_KEY`,
            type: "SecureString",
            value: resendApiKey,
            tags,
          },
          { protect: true },
        ),
      ]
    : [];
  new aws.ssm.Parameter(
    "migration-database-url",
    {
      name: `/lazuli/${environment}/migration/DATABASE_URL`,
      type: "SecureString",
      value: databaseUrl(`lazuli_${environment}_owner`, ownerPassword),
      tags,
    },
    { protect: true },
  );
  const role = new aws.iam.Role(
    "runtime",
    {
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { Service: "ec2.amazonaws.com" },
            Action: "sts:AssumeRole",
          },
        ],
      }),
      tags,
    },
    { protect: true },
  );
  // AmazonSSMManagedInstanceCore also grants GetParameter(s) on every parameter.
  // Keep agent communications here and grant runtime parameter reads separately.
  const ssm = new aws.iam.RolePolicy(
    "runtime-ssm",
    {
      role: role.name,
      policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Resource: "*",
            Action: [
              "ssm:DescribeAssociation",
              "ssm:GetDeployablePatchSnapshotForInstance",
              "ssm:GetDocument",
              "ssm:DescribeDocument",
              "ssm:GetManifest",
              "ssm:ListAssociations",
              "ssm:ListInstanceAssociations",
              "ssm:PutInventory",
              "ssm:PutComplianceItems",
              "ssm:PutConfigurePackageResult",
              "ssm:UpdateAssociationStatus",
              "ssm:UpdateInstanceAssociationStatus",
              "ssm:UpdateInstanceInformation",
              "ssmmessages:CreateControlChannel",
              "ssmmessages:CreateDataChannel",
              "ssmmessages:OpenControlChannel",
              "ssmmessages:OpenDataChannel",
            ],
          },
        ],
      }),
    },
    { protect: true },
  );
  new aws.iam.RolePolicy(
    "runtime-parameters",
    {
      role: role.name,
      policy: pulumi
        .all([
          runtimeDatabase.arn,
          authSecret.arn,
          runtimeConfig.arn,
          ...optionalSecrets.map((parameter) => parameter.arn),
          ...(hatchetParameter ? [hatchetParameter.arn] : []),
        ])
        .apply((resources) =>
          JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Action: ["ssm:GetParameter", "ssm:GetParameters"],
                Resource: resources,
              },
            ],
          }),
        ),
    },
    { protect: true },
  );
  new aws.iam.RolePolicy(
    "runtime-files",
    {
      role: role.name,
      policy: files.arn.apply((arn) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
              Resource: `${arn}/*`,
            },
          ],
        }),
      ),
    },
    { protect: true },
  );
  new aws.iam.RolePolicy(
    "runtime-images",
    {
      role: role.name,
      policy: imageRepository.arn.apply((arn) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            { Effect: "Allow", Action: ["ecr:GetAuthorizationToken"], Resource: "*" },
            {
              Effect: "Allow",
              Action: [
                "ecr:BatchGetImage",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchCheckLayerAvailability",
              ],
              Resource: arn,
            },
          ],
        }),
      ),
    },
    { protect: true },
  );
  const profile = new aws.iam.InstanceProfile(
    "runtime",
    { role: role.name, tags },
    { protect: true },
  );
  const group = new aws.ec2.SecurityGroup(
    "application",
    {
      vpcId: network.vpcId,
      description: "Operator access via SSM; no public application until TLS deployment",
      ingress: appUrl
        ? [
            { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
            { protocol: "tcp", fromPort: 443, toPort: 443, cidrBlocks: ["0.0.0.0/0"] },
          ]
        : [],
      egress: [
        // HTTPS covers SSM, AWS APIs, Hatchet and image/package downloads.
        { protocol: "tcp", fromPort: 443, toPort: 443, cidrBlocks: ["0.0.0.0/0"] },
        { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
        {
          protocol: "tcp",
          fromPort: 5432,
          toPort: 5432,
          securityGroups: [network.databaseSecurityGroupId],
        },
      ],
      tags,
    },
    { protect: true },
  );

  const template = new aws.ec2.LaunchTemplate(
    "application",
    {
      imageId: config.require("amiId"),
      instanceType: "t4g.small",
      iamInstanceProfile: { name: profile.name },
      creditSpecification: { cpuCredits: "standard" },
      metadataOptions: {
        httpEndpoint: "enabled",
        httpTokens: "required",
        httpPutResponseHopLimit: 2,
      },
      blockDeviceMappings: [
        {
          deviceName: "/dev/xvda",
          ebs: {
            volumeSize: 20,
            volumeType: "gp3",
            encrypted: "true",
            deleteOnTermination: "false",
          },
        },
      ],
      userData: Buffer.from(
        `#!/bin/bash
set -euo pipefail
dnf install -y docker postgresql16 jq
install -d -m 0755 /etc/docker
cat > /etc/docker/daemon.json <<'DOCKER_CONFIG'
{"log-driver":"local","log-opts":{"max-size":"10m","max-file":"3"}}
DOCKER_CONFIG
systemctl enable --now docker
install -d -m 0750 /opt/lazuli
curl --fail --silent --show-error https://truststore.pki.rds.amazonaws.com/us-east-2/us-east-2-bundle.pem -o /opt/lazuli/rds-ca.pem
${mailpitSetup}
touch /opt/lazuli/host-ready
`,
      ).toString("base64"),
      tags,
    },
    { protect: true },
  );
  const instance = new aws.ec2.Instance(
    "application",
    {
      launchTemplate: { id: template.id, version: template.latestVersion.apply(String) },
      subnetId: network.applicationSubnetIds[environment],
      vpcSecurityGroupIds: [group.id, network.clientSecurityGroupIds[environment]],
      associatePublicIpAddress: true,
      disableApiTermination: true,
      tags: { ...tags, Name: `lazuli-${environment}` },
      volumeTags: tags,
    },
    // The launch template owns bootstrap data; provider refresh also reads it on
    // the instance. Do not clear it (and restart the host) during secret updates.
    { protect: true, dependsOn: [ssm], ignoreChanges: ["userData"] },
  );
  const address = new aws.ec2.Eip("application", { domain: "vpc", tags }, { protect: true });
  const association = new aws.ec2.EipAssociation(
    "application",
    {
      allocationId: address.id,
      instanceId: instance.id,
    },
    { protect: true },
  );
  // This resource is named ec2transitgateway by the provider, but controls EC2 power.
  // Keep the initial deployment running until cloud-init and SSM checks pass.
  const state = new aws.ec2transitgateway.InstanceState(
    "application-power",
    {
      instanceId: instance.id,
      state: config.getBoolean("running") === false ? "stopped" : "running",
      force: false,
    },
    { dependsOn: [association] },
  );
  return {
    instanceId: instance.id,
    publicIp: address.publicIp,
    state: state.state,
    roleArn: role.arn,
    imageRepositoryUrl: imageRepository.repositoryUrl,
  };
}
