include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../..//base-infrastructure"
}

inputs = {
  # General
  aws_region  = "us-east-1"
  environment = "dev"

  # Network
  vpc_name           = "todo-app-dev-vpc"
  vpc_cidr           = "10.0.0.0/16"
  private_subnets    = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets     = ["10.0.101.0/24", "10.0.102.0/24"]
  single_nat_gateway = true

  # EKS Cluster
  cluster_name                   = "todo-app-dev-eks"
  cluster_version                = "1.36"
  cluster_endpoint_public_access = true
  cluster_enabled_log_types      = ["api", "audit", "authenticator"]
  node_instance_type             = "t3.large"
  node_min_size                  = 2
  node_desired_size              = 2
  node_max_size                  = 4

  # Learner Lab IAM constraint: reuse pre-existing LabRole instead of creating IAM/KMS/OIDC
  use_existing_lab_role = true
  lab_role_arn          = "arn:aws:iam::425959969184:role/LabRole"

  # ECR
  ecr_image_tag_mutability = "MUTABLE"
  ecr_max_image_count      = 20

  # GitHub Actions OIDC (disabled on Learner Lab; CI uses temporary AWS session secrets)
  enable_github_oidc          = false
  create_github_oidc_provider = false
  github_repo                 = "anhhao1712/gitaction"
  github_allowed_branches     = ["main"]
  github_actions_role_name    = "todo-app-dev-github-actions-ecr"
}