variable "cluster_name" {
  type        = string
  description = "Name of the EKS cluster"
}

variable "oidc_provider_arn" {
  type        = string
  description = "ARN of the EKS OIDC provider"
  default     = null
}

variable "cluster_oidc_issuer_url" {
  type        = string
  description = "OIDC issuer URL of the EKS cluster"
  default     = null
}

variable "use_existing_lab_role" {
  type        = bool
  description = "Skip creating IRSA IAM roles/policies and let node LabRole provide permissions"
  default     = false
}

variable "lab_role_arn" {
  type        = string
  description = "Pre-existing LabRole ARN returned in outputs when use_existing_lab_role is true"
  default     = null
}