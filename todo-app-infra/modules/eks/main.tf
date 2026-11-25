module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

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