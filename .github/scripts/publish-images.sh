#!/usr/bin/env bash
set -euo pipefail

case "$COMPONENT" in
  backend|frontend) ;;
  *) echo "Unknown component: $COMPONENT" >&2; exit 1 ;;
esac

archive="images/${COMPONENT}/image-${COMPONENT}.tar.gz"
test -f "$archive"
gzip -dc "$archive" | docker load

tag="sha-${GITHUB_SHA}"
ecr_env="${ECR_ENV:-dev}"
repository="todo-app-${COMPONENT}-${ecr_env}"
local_image="todo-app-${COMPONENT}:${tag}"
remote_image="${ECR_REGISTRY}/${repository}:${tag}"
docker tag "$local_image" "$remote_image"
docker push "$remote_image"

jq -n --arg component "$COMPONENT" --arg image "$remote_image" \
  '{component: $component, image: $image, digest: null}' > "release-${COMPONENT}.json"

digest="$(aws ecr describe-images \
  --region "$AWS_REGION" \
  --repository-name "$repository" \
  --image-ids "imageTag=${tag}" \
  --query 'imageDetails[0].imageDigest' \
  --output text)"
if [[ ! "$digest" =~ ^sha256:[0-9a-f]{64}$ ]]; then
  echo "Could not confirm digest for ${remote_image}" >&2
  exit 1
fi

jq -n --arg component "$COMPONENT" --arg image "$remote_image" --arg digest "$digest" \
  '{component: $component, image: $image, digest: $digest}' > "release-${COMPONENT}.json"
