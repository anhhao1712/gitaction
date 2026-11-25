output "ebs_csi_driver_role_arn" {
  description = "IRSA role ARN for the EBS CSI Driver add-on (or LabRole when reusing existing role)"
  value       = var.use_existing_lab_role ? var.lab_role_arn : aws_iam_role.ebs_csi_driver[0].arn
}

output "aws_load_balancer_controller_role_arn" {
  description = "IRSA role ARN for the AWS Load Balancer Controller (or LabRole when reusing existing role)"
  value       = var.use_existing_lab_role ? var.lab_role_arn : aws_iam_role.aws_load_balancer_controller[0].arn
}
