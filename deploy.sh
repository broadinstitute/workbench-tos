#!/usr/bin/env bash
set -e
set -x

VAULT_TOKEN=$1
GIT_BRANCH=$2

if [ "$GIT_BRANCH" == "develop" ]; then
    ENVIRONMENT="dev"
elif [ "$GIT_BRANCH" == "alpha" ]; then
    ENVIRONMENT="alpha"
elif [ "$GIT_BRANCH" == "perf" ]; then
	ENVIRONMENT="perf"
elif [ "$GIT_BRANCH" == "staging" ]; then
    ENVIRONMENT="staging"
elif [ "$GIT_BRANCH" == "master" ]; then
    ENVIRONMENT="prod"
else
    echo "Git branch '$GIT_BRANCH' is not configured to automatically deploy to a target environment"
    exit 1
fi

PROJECT_NAME="broad-workbench-tos-${ENVIRONMENT}"

SERVICE_ACCT_KEY_FILE="deploy_account.json"
# Get the environment-specific credentials for the service account out of Vault
# Put key into SERVICE_ACCT_KEY_FILE
docker run --rm -e VAULT_TOKEN=${VAULT_TOKEN} broadinstitute/dsde-toolbox vault read --format=json "secret/dsde/firecloud/${ENVIRONMENT}/tos/deploy-sa" | jq .data > ${SERVICE_ACCT_KEY_FILE}

CODEBASE_PATH=/workbench-tos
# Process all Consul .ctmpl files
# Vault token is required by the docker image regardless of whether you have any data in Vault or not
docker run --rm -v $PWD:${CODEBASE_PATH} \
  -e INPUT_PATH=${CODEBASE_PATH}/function \
  -e OUT_PATH=${CODEBASE_PATH}/function \
  -e ENVIRONMENT=${ENVIRONMENT} \
  -e VAULT_TOKEN=${VAULT_TOKEN} \
  broadinstitute/dsde-toolbox render-templates.sh

# Use google/cloud-sdk image to deploy the cloud function
# TODO: is there a smaller version of this image we can use?
docker run --rm -v $PWD:${CODEBASE_PATH} \
    -e BASE_URL="https://us-central1-broad-dsde-${ENVIRONMENT}.cloudfunctions.net" \
    google/cloud-sdk:latest /bin/bash -c \
    "gcloud config set project ${PROJECT_NAME} &&
     gcloud auth activate-service-account --key-file ${CODEBASE_PATH}/${SERVICE_ACCT_KEY_FILE} &&
     cd ${CODEBASE_PATH} &&
     gcloud beta functions deploy tos --source=./function --trigger-http --runtime nodejs6"
