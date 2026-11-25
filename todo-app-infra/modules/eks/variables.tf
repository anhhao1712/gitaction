variable "cluster_name" {
  type        = string
  description = "Name of the EKS cluster"
}

variable "cluster_version" {
  type        = string
  description = "Kubernetes minor version for the EKS control plane"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID where the EKS cluster will be deployed"
}

variable "subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for EKS control plane and worker nodes"
}

variable "cluster_endpoint_public_access" {
  type        = bool
  description = "Whether the EKS public API server endpoint is enabled"
  default     = true
}

variable "cluster_enabled_log_types" {
  type        = list(string)
  description = "Control plane log types to enable"
  default     = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
}

variable "node_instance_type" {
  type        = string
  description = "EC2 instance type for EKS managed node group"
}

variable "node_min_size" {
  type        = number
  description = "Minimum number of worker nodes"
}

variable "node_desired_size" {
  type        = number
  description = "Desired number of worker nodes"
}

variable "node_max_size" {
  type        = number
  description = "Maximum number of worker nodes"
}

variable "use_existing_lab_role" {
  type        = bool
  description = "Reuse existing AWS Academy LabRole instead of creating IAM roles, KMS key, and IRSA OIDC provider"
  default     = false
}

variable "lab_role_arn" {
  type        = string
  description = "ARN of the pre-existing LabRole to assign to EKS cluster and managed node group"
  default     = null
}
