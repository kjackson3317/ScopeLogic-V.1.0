#!/usr/bin/env bash
# Demo branch isolation. Existing production SLC projects are ignored.
# The existing preview project is allowed temporarily for demo build QA.
case "$VERCEL_PROJECT_ID" in
  prj_fwTBCNUFRDKl3CUSFxp9wkkQiFlO) exit 1 ;;
  prj_TFZgqoOD7pnm1tC0LefH8QF6An5W|prj_qot4Zbr39nWn9nGju0pSwckPyXHw|prj_ipnbp64ABSNEmGR98OiymgaE49lP) exit 0 ;;
  *) exit 1 ;;
esac
