# aws cloudformation delete-stack --stack-name outmateAppStack
aws ecr delete-repository --repository-name outmate-backend-repository --force
# aws ecr delete-repository --repository-name outmate-frontend-repository --force
# aws ecr describe-repositories --output json | jq -re ".repositories[].repositoryName"