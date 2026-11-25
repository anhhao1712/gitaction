variable "vpc_name" {
  type        = string
  description = "Name of the VPC"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC"
}

variable "azs" {
  type        = list(string)
  description = "List of Availability Zones"
}

variable "private_subnets" {
  type        = list(string)
  description = "List of private subnet CIDR blocks"
}

variable "public_subnets" {
  type        = list(string)
  description = "List of public subnet CIDR blocks"
}

variable "single_nat_gateway" {
  type        = bool
  description = "Use a single shared NAT Gateway (true for dev, false for prod HA)"
  default     = true
}

variable "cluster_name" {
  type        = string
  description = "EKS cluster name for subnet discovery tags"
}