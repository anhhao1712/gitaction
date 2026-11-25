include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../..//base-infrastructure"
}

inputs = {
  # General (Note: Learner Lab test uses live/dev single-cluster setup with todo-dev and todo-prod namespaces)
  aws_region  = "us-east-1"
  environment = "prod"

  # Network
  vpc_name           = "todo-app-prod-vpc"
  vpc_cidr           = "10.20.0.0/16"
  private_subnets    = ["10.20.1.0/24", "10.20.2.0/24"]
  public_subnets     = ["10.20.101.0/24", "10.20.102.0/24"]
  single_nat_gateway = false

  # EKS Cluster
  cluster_name                   = "todo-app-prod-eks"
  cluster_version                = "1.36"
  cluster_endpoint_public_access = false
  cluster_enabled_log_types      = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
  node_instance_type             = "t3.large"
  node_min_size                  = 2
  node_desired_size              = 3
  node_max_size                  = 6

  # Learner Lab IAM constraint
  use_existing_lab_role = true
  lab_role_arn          = "arn:aws:iam::425959969184:role/LabRole"

  # ECR
  ecr_image_tag_mutability = "IMMUTABLE"
  ecr_max_image_count      = 30

  # GitHub Actions OIDC (disabled on Learner Lab)
  enable_github_oidc          = false
  create_github_oidc_provider = false
  github_repo                 = "anhhao1712/gitaction"
  github_allowed_branches     = ["main"]
  github_actions_role_name    = "todo-app-prod-github-actions-ecr"
}