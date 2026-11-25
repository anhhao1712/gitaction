module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"
  count   = var.use_existing_lab_role ? 0 : 1

  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version
  enable_irsa     = !var.use_existing_lab_role

  create_iam_role           = !var.use_existing_lab_role
  iam_role_arn              = var.use_existing_lab_role ? var.lab_role_arn : null
  create_kms_key            = !var.use_existing_lab_role
  cluster_encryption_config = var.use_existing_lab_role ? {} : { resources = ["secrets"] }

  cluster_endpoint_private_access          = true
  cluster_endpoint_public_access           = var.cluster_endpoint_public_access
  enable_cluster_creator_admin_permissions = true

  cluster_enabled_log_types = var.cluster_enabled_log_types

  vpc_id                   = var.vpc_id
  subnet_ids               = var.subnet_ids
  control_plane_subnet_ids = var.subnet_ids

  eks_managed_node_groups = {
    my-nodes = {
      ami_type        = "AL2023_x86_64_STANDARD"
      min_size        = var.node_min_size
      max_size        = var.node_max_size
      desired_size    = var.node_desired_size
      instance_types  = [var.node_instance_type]
      capacity_type   = "ON_DEMAND"
      create_iam_role = !var.use_existing_lab_role
      iam_role_arn    = var.use_existing_lab_role ? var.lab_role_arn : null
      metadata_options = {
        http_endpoint               = "enabled"
        http_tokens                 = "required"
        http_put_response_hop_limit = 2
      }
    }
  }
}

# Learner Lab mode: bypass terraform-aws-modules/eks (which calls iam:GetRole on voclabs)
resource "aws_eks_cluster" "lab" {
  count = var.use_existing_lab_role ? 1 : 0

  name                      = var.cluster_name
  version                   = var.cluster_version
  role_arn                  = var.lab_role_arn
  enabled_cluster_log_types = var.cluster_enabled_log_types

  vpc_config {
    subnet_ids              = var.subnet_ids
    endpoint_private_access = true
    endpoint_public_access  = var.cluster_endpoint_public_access
  }

  access_config {
    authentication_mode                         = "API_AND_CONFIG_MAP"
    bootstrap_cluster_creator_admin_permissions = true
  }
}

resource "aws_launch_template" "lab_nodes" {
  count = var.use_existing_lab_role ? 1 : 0

  name_prefix = "${var.cluster_name}-nodes-"

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }
}

resource "aws_eks_node_group" "lab_nodes" {
  count = var.use_existing_lab_role ? 1 : 0

  cluster_name    = aws_eks_cluster.lab[0].name
  node_group_name = "my-nodes"
  node_role_arn   = var.lab_role_arn
  subnet_ids      = var.subnet_ids

  ami_type       = "AL2023_x86_64_STANDARD"
  capacity_type  = "ON_DEMAND"
  instance_types = [var.node_instance_type]

  scaling_config {
    desired_size = var.node_desired_size
    max_size     = var.node_max_size
    min_size     = var.node_min_size
  }

  launch_template {
    id      = aws_launch_template.lab_nodes[0].id
    version = aws_launch_template.lab_nodes[0].latest_version
  }
}