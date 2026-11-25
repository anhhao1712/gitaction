variable "aws_region" {
  type        = string
  description = "AWS deployment region"
}

variable "environment" {
  type        = string
  description = "Target deployment environment (dev or prod)"
}

variable "vpc_name" {
  type        = string
  description = "Name of the VPC"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC"
}

variable "private_subnets" {
  type        = list(string)
  description = "Private subnet CIDR blocks"
}

variable "public_subnets" {
  type        = list(string)
  description = "Public subnet CIDR blocks"
}

variable "single_nat_gateway" {
  type        = bool
  description = "Use single NAT Gateway instead of one per AZ"
}

variable "cluster_name" {
  type        = string
  description = "Name of the EKS cluster"
}

variable "cluster_version" {
  type        = string
  description = "Kubernetes minor version for the EKS control plane"
}

variable "cluster_endpoint_public_access" {
  type        = bool
  description = "Enable public access to EKS API endpoint"
}

variable "cluster_enabled_log_types" {
  type        = list(string)
  description = "Control plane log types"
}

variable "node_instance_type" {
  type        = string
  description = "Instance type for EKS worker nodes"
}

variable "node_min_size" {
  type        = number
  description = "Minimum worker nodes"
}

variable "node_desired_size" {
  type        = number
  description = "Desired worker nodes"
}

variable "node_max_size" {
  type        = number
  description = "Maximum worker nodes"
}

variable "ecr_image_tag_mutability" {
  type        = string
  description = "ECR image tag mutability (MUTABLE or IMMUTABLE)"
}

variable "ecr_max_image_count" {
  type        = number
  description = "Max images kept in ECR lifecycle policy"
}

variable "enable_github_oidc" {
  type        = bool
  description = "Whether to create GitHub OIDC provider and ECR push IAM role"
  default     = true
}

variable "create_github_oidc_provider" {
  type        = bool
  description = "Create AWS IAM OIDC provider for GitHub Actions (set false if it already exists in the account)"
  default     = true
}

variable "github_repo" {
  type        = string
  description = "GitHub repository (owner/repo) allowed to assume the CI IAM role via OIDC"
}

variable "github_allowed_branches" {
  type        = list(string)
  description = "Git branches allowed to assume the CI IAM role"
  default     = ["main"]
}

variable "github_actions_role_name" {
  type        = string
  description = "IAM role name for GitHub Actions ECR publishing"
}

variable "use_existing_lab_role" {
  type        = bool
  description = "Reuse existing AWS Academy LabRole instead of creating IAM roles, KMS key, and IRSA OIDC provider"
  default     = false
}

variable "lab_role_arn" {
  type        = string
  description = "ARN of pre-existing LabRole when use_existing_lab_role is true"
  default     = null
}