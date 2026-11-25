variable "github_repo" {
  type        = string
  description = "GitHub repository in owner/name format allowed to assume the role"

  validation {
    condition     = can(regex("^[^/]+/[^/]+$", var.github_repo))
    error_message = "github_repo must be in owner/repo format (for example, phuocan803/todo-app-src)."
  }
}

variable "allowed_branches" {
  type        = list(string)
  description = "Git branches allowed to assume the IAM role via GitHub OIDC"
  default     = ["main"]

  validation {
    condition     = length(var.allowed_branches) > 0
    error_message = "allowed_branches must contain at least one branch name."
  }
}

variable "role_name" {
  type        = string
  description = "Name of the IAM role assumed by GitHub Actions"
}

variable "ecr_repository_arns" {
  type        = list(string)
  description = "List of ECR repository ARNs that GitHub Actions is allowed to push to"

  validation {
    condition     = length(var.ecr_repository_arns) > 0
    error_message = "ecr_repository_arns must contain at least one ECR repository ARN."
  }
}

variable "create_oidc_provider" {
  type        = bool
  description = "Whether to create the GitHub OIDC provider (false if one already exists in the AWS account)"
  default     = true
}
