# AWS permissions required by this workflow

This file is a configuration example for restoring OIDC when the AWS account allows role creation. For the temporary lab test, the workflow uses `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN` from GitHub Actions secrets instead of `AWS_ROLE_ARN`. No files in `todo-app-infra` are required or changed by this CI setup.

1. In IAM, create or reuse the OIDC provider `https://token.actions.githubusercontent.com` with audience `sts.amazonaws.com`.
2. Create a role such as `todo-app-ecr-publisher` with the trust policy below. Replace `<ACCOUNT_ID>` with the AWS account ID. The `sub` condition must match the GitHub repository and protected release branch exactly.
3. Attach the ECR policy below, again replacing `<ACCOUNT_ID>` and the region if needed. It grants push and digest lookup only for the two Todo repositories. `ecr:GetAuthorizationToken` requires `Resource: "*"`.
4. Create or identify the private ECR repositories `todo-app-backend` and `todo-app-frontend` in the same region. Set image tag mutability to **immutable**. ECR scan on push can be enabled for extra visibility; the blocking scan is Trivy before push.
5. When switching back to OIDC, set the GitHub Actions repository variable `AWS_ROLE_ARN` to the role ARN, restore the role-based credentials step in `ci.yml`, and protect `main` with required CI checks.

Role trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:phuocan803/todo-app-src:ref:refs/heads/main"
      }
    }
  }]
}
```

Role permissions policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:CompleteLayerUpload",
        "ecr:DescribeImages",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart"
      ],
      "Resource": [
        "arn:aws:ecr:ap-southeast-1:<ACCOUNT_ID>:repository/todo-app-backend",
        "arn:aws:ecr:ap-southeast-1:<ACCOUNT_ID>:repository/todo-app-frontend"
      ]
    }
  ]
}
```
