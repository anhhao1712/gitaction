variable "environment" {
  type        = string
  description = "Environment name appended to repository names"
}

variable "repositories" {
  type        = map(string)
  description = "Map of logical key to base ECR repository name"
  default = {
    frontend = "todo-app-frontend"
    backend  = "todo-app-backend"
  }
}

variable "image_tag_mutability" {
  type        = string
  description = "Tag mutability setting (MUTABLE for dev, IMMUTABLE for prod)"
  default     = "MUTABLE"

  validation {
    condition     = contains(["MUTABLE", "IMMUTABLE"], var.image_tag_mutability)
    error_message = "image_tag_mutability must be either MUTABLE or IMMUTABLE."
  }
}

variable "max_image_count" {
  type        = number
  description = "Maximum number of images to retain per repository"
  default     = 10
}
