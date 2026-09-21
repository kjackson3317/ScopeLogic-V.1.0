#!/usr/bin/env bash
set -e

PRODUCTION_PROJECT_ID="prj_TFZgqoOD7pnm1tC0LefH8QF6An5W"
PREVIEW_PROJECT_ID="prj_fwTBCNUFRDKl3CUSFxp9wkkQiFlO"

if [ "$VERCEL_PROJECT_ID" = "$PRODUCTION_PROJECT_ID" ]; then
  if [ "$VERCEL_GIT_COMMIT_REF" = "main" ] || [ "$VERCEL_GIT_COMMIT_REF" = "preview" ]; then
    exit 1
  fi
  exit 0
fi

if [ "$VERCEL_PROJECT_ID" = "$PREVIEW_PROJECT_ID" ]; then
  if [ "$VERCEL_GIT_COMMIT_REF" = "preview" ]; then
    exit 1
  fi
  exit 0
fi

exit 0
