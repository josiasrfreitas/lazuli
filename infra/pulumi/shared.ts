import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

/** Shared resources stay alive when either application environment is stopped. */
export function createSharedInfrastructure() {
  const tags = { Project: "lazuli", Environment: "shared" };
  const protectedResource = { protect: true };
  const config = new pulumi.Config();
  const zones = config.requireObject<string[]>("availabilityZones");
  if (
    zones.length !== 2 ||
    new Set(zones).size !== 2 ||
    zones.some((zone) => !/^us-east-2[a-z]$/.test(zone))
  ) {
    throw new Error("availabilityZones must contain two distinct us-east-2 zones.");
  }

  const vpc = new aws.ec2.Vpc(
    "shared-network",
    {
      cidrBlock: "10.42.0.0/16",
      enableDnsHostnames: true,
      enableDnsSupport: true,
      tags,
    },
    protectedResource,
  );

  // Explicit local-only routes keep the database private even if the VPC main
  // route table later changes to support public application instances.
  const privateRoutes = new aws.ec2.RouteTable(
    "database-private-routes",
    {
      vpcId: vpc.id,
      routes: [],
      tags,
    },
    protectedResource,
  );
  const databaseSubnets = zones.map((zone, index) => {
    const subnet = new aws.ec2.Subnet(
      `database-${index}`,
      {
        vpcId: vpc.id,
        cidrBlock: `10.42.${10 + index}.0/24`,
        availabilityZone: zone,
        mapPublicIpOnLaunch: false,
        tags,
      },
      protectedResource,
    );
    new aws.ec2.RouteTableAssociation(
      `database-${index}-routes`,
      {
        subnetId: subnet.id,
        routeTableId: privateRoutes.id,
      },
      protectedResource,
    );
    return subnet;
  });

  const clients = Object.fromEntries(
    (["staging", "prod"] as const).map((environment) => {
      const group = new aws.ec2.SecurityGroup(
        `${environment}-database-client`,
        {
          vpcId: vpc.id,
          description: `Database access identity for Lazuli ${environment}`,
          ingress: [],
          egress: [],
          tags: { ...tags, Environment: environment },
        },
        protectedResource,
      );
      return [environment, group];
    }),
  );
  const databaseGroup = new aws.ec2.SecurityGroup(
    "database",
    {
      vpcId: vpc.id,
      description: "Private PostgreSQL; only application client security groups",
      ingress: Object.values(clients).map((group) => ({
        protocol: "tcp",
        fromPort: 5432,
        toPort: 5432,
        securityGroups: [group.id],
      })),
      egress: [],
      tags,
    },
    protectedResource,
  );
  // Client groups carry ingress identity only. Application stacks must also
  // attach their own egress security group; no application hosts exist yet.
  const subnetGroup = new aws.rds.SubnetGroup(
    "database",
    {
      subnetIds: databaseSubnets.map((subnet) => subnet.id),
      tags,
    },
    protectedResource,
  );
  const parameters = new aws.rds.ParameterGroup(
    "postgres16",
    {
      family: "postgres16",
      parameters: [{ name: "rds.force_ssl", value: "1", applyMethod: "immediate" }],
      tags,
    },
    protectedResource,
  );
  const database = new aws.rds.Instance(
    "postgres",
    {
      identifier: "lazuli-shared-postgres",
      engine: "postgres",
      engineVersion: "16",
      engineLifecycleSupport: "open-source-rds-extended-support-disabled",
      instanceClass: "db.t4g.micro",
      allocatedStorage: 20,
      storageType: "gp3",
      storageEncrypted: true,
      dbName: "lazuli_admin",
      username: "lazuli_admin",
      manageMasterUserPassword: true,
      port: 5432,
      publiclyAccessible: false,
      multiAz: false,
      availabilityZone: zones[0],
      dbSubnetGroupName: subnetGroup.name,
      vpcSecurityGroupIds: [databaseGroup.id],
      parameterGroupName: parameters.name,
      backupRetentionPeriod: 7,
      backupWindow: "06:00-07:00",
      maintenanceWindow: "sun:07:00-sun:08:00",
      autoMinorVersionUpgrade: true,
      allowMajorVersionUpgrade: false,
      applyImmediately: false,
      deletionProtection: true,
      skipFinalSnapshot: false,
      finalSnapshotIdentifier: "lazuli-shared-postgres-final",
      deleteAutomatedBackups: false,
      copyTagsToSnapshot: true,
      tags,
    },
    protectedResource,
  );

  const gateway = new aws.ec2.InternetGateway(
    "applications",
    { vpcId: vpc.id, tags },
    protectedResource,
  );
  const publicRoutes = new aws.ec2.RouteTable(
    "application-public-routes",
    {
      vpcId: vpc.id,
      routes: [{ cidrBlock: "0.0.0.0/0", gatewayId: gateway.id }],
      tags,
    },
    protectedResource,
  );
  const applicationSubnets = Object.fromEntries(
    (["staging", "prod"] as const).map((environment, index) => {
      const subnet = new aws.ec2.Subnet(
        `${environment}-application`,
        {
          vpcId: vpc.id,
          cidrBlock: `10.42.${20 + index}.0/24`,
          availabilityZone: zones[0],
          mapPublicIpOnLaunch: false,
          tags: { ...tags, Environment: environment },
        },
        protectedResource,
      );
      new aws.ec2.RouteTableAssociation(
        `${environment}-application-routes`,
        {
          subnetId: subnet.id,
          routeTableId: publicRoutes.id,
        },
        protectedResource,
      );
      return [environment, subnet.id];
    }),
  );

  return {
    vpcId: vpc.id,
    applicationSubnetIds: applicationSubnets,
    availabilityZone: zones[0],
    databaseIdentifier: database.identifier,
    databaseAddress: database.address,
    databasePort: database.port,
    databaseSecurityGroupId: databaseGroup.id,
    clientSecurityGroupIds: Object.fromEntries(
      Object.entries(clients).map(([environment, group]) => [environment, group.id]),
    ),
    // ARN only; the managed administrator password never becomes a stack output.
    databaseAdminSecretArn: database.masterUserSecrets.apply((secrets) => secrets[0]?.secretArn),
  };
}
