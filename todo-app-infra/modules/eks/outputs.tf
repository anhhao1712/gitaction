output "cluster_name" {
  description = "Name of the EKS Cluster"
  value       = var.use_existing_lab_role ? aws_eks_cluster.lab[0].name : module.eks[0].cluster_name
}

output "cluster_endpoint" {
  description = "Endpoint of the EKS Control Plane"
  value       = var.use_existing_lab_role ? aws_eks_cluster.lab[0].endpoint : module.eks[0].cluster_endpoint
}

output "oidc_provider_arn" {
  description = "ARN of the OIDC Provider for IRSA"
  value       = var.use_existing_lab_role ? null : module.eks[0].oidc_provider_arn
}

output "cluster_oidc_issuer_url" {
  description = "The URL on the EKS cluster for the OpenID Connect identity provider"
  value       = var.use_existing_lab_role ? try(aws_eks_cluster.lab[0].identity[0].oidc[0].issuer, null) : module.eks[0].cluster_oidc_issuer_url
}
