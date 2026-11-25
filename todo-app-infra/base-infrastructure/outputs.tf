output "cluster_name" {
  description = "Name of the EKS Cluster"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "Endpoint of the EKS Control Plane"
  value       = module.eks.cluster_endpoint
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.network.vpc_id
}

output "frontend_ecr_url" {
  description = "ECR URL for Frontend"
  value       = module.ecr.repository_urls["frontend"]
}

output "backend_ecr_url" {
  description = "ECR URL for Backend"
  value       = module.ecr.repository_urls["backend"]
}

output "aws_load_balancer_controller_role_arn" {
  description = "IRSA role ARN for the AWS Load Balancer Controller"
  value       = module.iam_security.aws_load_balancer_controller_role_arn
}

output "ebs_csi_driver_role_arn" {
  description = "IRSA role ARN for the EBS CSI Driver add-on"
  value       = module.iam_security.ebs_csi_driver_role_arn
}

output "github_oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC identity provider"
  value       = var.enable_github_oidc ? module.github_oidc[0].oidc_provider_arn : null
}

output "github_actions_role_arn" {
  description = "IAM role ARN for GitHub Actions (assign to vars.AWS_ROLE_ARN in todo-app-src)"
  value       = var.enable_github_oidc ? module.github_oidc[0].github_actions_role_arn : null
}