#!/usr/bin/env bash
# This dedicated demo branch must never build in the existing SLC projects.
case "$VERCEL_PROJECT_ID" in
  prj_TFZgqoOD7pnm1tC0LefH8QF6An5W|prj_fwTBCNUFRDKl3CUSFxp9wkkQiFlO|prj_qot4Zbr39nWn9nGju0pSwckPyXHw|prj_ipnbp64ABSNEmGR98OiymgaE49lP) exit 0 ;;
  *) exit 1 ;;
esac
