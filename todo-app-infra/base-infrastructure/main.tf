module "network" {
  source = "../modules/network"

  vpc_name           = var.vpc_name
  vpc_cidr           = var.vpc_cidr
  azs                = ["${var.aws_region}a", "${var.aws_region}b"]
  private_subnets    = var.private_subnets
  public_subnets     = var.public_subnets
  single_nat_gateway = var.single_nat_gateway
  cluster_name       = var.cluster_name
}

module "eks" {
  source = "../modules/eks"

  cluster_name                   = var.cluster_name
  cluster_version                = var.cluster_version
  vpc_id                         = module.network.vpc_id
  subnet_ids                     = module.network.private_subnets
  cluster_endpoint_public_access = var.cluster_endpoint_public_access
  cluster_enabled_log_types      = var.cluster_enabled_log_types
  node_instance_type             = var.node_instance_type
  node_min_size                  = var.node_min_size
  node_desired_size              = var.node_desired_size
  node_max_size                  = var.node_max_size
  use_existing_lab_role          = var.use_existing_lab_role
  lab_role_arn                   = var.lab_role_arn
}

module "iam_security" {
  source     = "../modules/iam-security"
  depends_on = [module.eks]

  cluster_name            = module.eks.cluster_name
  oidc_provider_arn       = module.eks.oidc_provider_arn
  cluster_oidc_issuer_url = module.eks.cluster_oidc_issuer_url
  use_existing_lab_role   = var.use_existing_lab_role
  lab_role_arn            = var.lab_role_arn
}

module "ecr" {
  source = "../modules/ecr"

  environment          = var.environment
  image_tag_mutability = var.ecr_image_tag_mutability
  max_image_count      = var.ecr_max_image_count
}

module "github_oidc" {
  source = "../modules/github-oidc"
  count  = var.enable_github_oidc ? 1 : 0

  github_repo          = var.github_repo
  allowed_branches     = var.github_allowed_branches
  role_name            = var.github_actions_role_name
  create_oidc_provider = var.create_github_oidc_provider
  ecr_repository_arns  = values(module.ecr.repository_arns)
}